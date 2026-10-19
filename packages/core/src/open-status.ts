export interface ScheduleRange {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed?: boolean;
}

export interface ScheduleException {
  date: string;
  isClosed: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
}

export type OpenReason =
  | 'open'
  | 'manual_closed'
  | 'inactive'
  | 'exception_closed'
  | 'outside_hours'
  | 'no_schedule';

export interface OpenStatus {
  isOpen: boolean;
  reason: OpenReason;
  localDate: string;
  localWeekday: number;
  localTime: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function getLocalParts(
  at: Date,
  timeZone: string,
): { date: string; weekday: number; time: string } {
  const parts = formatterFor(timeZone).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekdayLabel = value('weekday');
  const weekdayIndex = WEEKDAYS.indexOf(weekdayLabel as (typeof WEEKDAYS)[number]);

  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    weekday: weekdayIndex >= 0 ? weekdayIndex : 0,
    time: `${value('hour')}:${value('minute')}`,
  };
}

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function withinRange(time: string, opensAt: string, closesAt: string): boolean {
  const open = normalizeTime(opensAt);
  const close = normalizeTime(closesAt);
  // Los horarios que cruzan medianoche no se soportan en el MVP.
  if (close <= open) {
    return false;
  }
  return time >= open && time < close;
}

/**
 * Estado operativo de una sucursal.
 *
 * Regla: el interruptor manual manda. Si está cerrado manualmente, no importa
 * el horario. Si está abierto manualmente, igual debe estar dentro del horario
 * (o de una excepción) para recibir pedidos.
 */
export function computeOpenStatus(input: {
  at: Date;
  timeZone: string;
  status: string;
  manualOpen: boolean;
  hours: readonly ScheduleRange[];
  exceptions: readonly ScheduleException[];
}): OpenStatus {
  const local = getLocalParts(input.at, input.timeZone);
  const base = {
    localDate: local.date,
    localWeekday: local.weekday,
    localTime: local.time,
  };

  if (input.status !== 'active') {
    return { isOpen: false, reason: 'inactive', ...base };
  }
  if (!input.manualOpen) {
    return { isOpen: false, reason: 'manual_closed', ...base };
  }

  const exception = input.exceptions.find((item) => item.date === local.date);
  if (exception) {
    if (exception.isClosed) {
      return { isOpen: false, reason: 'exception_closed', ...base };
    }
    if (!exception.opensAt || !exception.closesAt) {
      return { isOpen: false, reason: 'outside_hours', ...base };
    }
    const open = withinRange(local.time, exception.opensAt, exception.closesAt);
    return { isOpen: open, reason: open ? 'open' : 'outside_hours', ...base };
  }

  const today = input.hours.filter(
    (range) => range.weekday === local.weekday && !range.isClosed,
  );
  if (today.length === 0) {
    return { isOpen: false, reason: 'no_schedule', ...base };
  }

  const open = today.some((range) => withinRange(local.time, range.opensAt, range.closesAt));
  return { isOpen: open, reason: open ? 'open' : 'outside_hours', ...base };
}
