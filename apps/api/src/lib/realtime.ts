export interface RealtimeSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: string, handler: () => void): void;
}

const connections = new Map<string, Set<RealtimeSocket>>();

export function addConnection(userId: string, socket: RealtimeSocket): void {
  const set = connections.get(userId) ?? new Set<RealtimeSocket>();
  set.add(socket);
  connections.set(userId, set);
}

export function removeConnection(userId: string, socket: RealtimeSocket): void {
  const set = connections.get(userId);
  if (!set) {
    return;
  }
  set.delete(socket);
  if (set.size === 0) {
    connections.delete(userId);
  }
}

export function publishToUser(userId: string, payload: Record<string, unknown>): void {
  const set = connections.get(userId);
  if (!set || set.size === 0) {
    return;
  }
  const data = JSON.stringify(payload);
  for (const socket of set) {
    if (socket.readyState === 1) {
      try {
        socket.send(data);
      } catch {
        set.delete(socket);
      }
    }
  }
}

export function publishToUsers(userIds: string[], payload: Record<string, unknown>): void {
  for (const userId of new Set(userIds)) {
    publishToUser(userId, payload);
  }
}

export function connectionCount(): number {
  let total = 0;
  for (const set of connections.values()) {
    total += set.size;
  }
  return total;
}
