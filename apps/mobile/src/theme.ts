import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Paleta y tokens de diseño de ClubSellBuy.
 * Un solo lugar para color, tipografía, espaciado y elevación: así web y
 * nativo comparten exactamente la misma identidad visual.
 */
export const colors = {
  /* Marca */
  brand: '#0F766E',
  brandDark: '#115E59',
  brandDeep: '#0B3F3B',
  brandSoft: '#CCFBF1',
  brandTint: '#F0FDFA',
  accent: '#F59E0B',
  accentSoft: '#FEF3C7',
  accentDark: '#92400E',
  accentTint: '#FFFCF5',

  /* Superficies */
  bg: '#F5F8F7',
  bgAlt: '#EDF3F1',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAF9',

  /* Texto */
  text: '#0F1F1C',
  textSoft: '#33443F',
  muted: '#5C6B67',
  subtle: '#64736F',
  onBrand: '#FFFFFF',
  onBrandMuted: '#D1FAE5',

  /* Bordes */
  border: '#E2E8E5',
  borderStrong: '#CBD6D2',

  /* Estados */
  danger: '#B42318',
  dangerDark: '#9F1D16',
  dangerSoft: '#FEE4E2',
  dangerBorder: '#FECACA',
  dangerTint: '#FFF8F7',
  success: '#15803D',
  successDark: '#11643C',
  successSoft: '#DCFCE7',
  successBorder: '#BBF7D0',
  info: '#1D4ED8',
  infoSoft: '#E0EAFF',
  infoBorder: '#C7D7FE',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  warningBorder: '#FDE68A',

  /* Utilidades */
  overlay: 'rgba(11, 63, 59, 0.48)',
  scrim: 'rgba(15, 31, 28, 0.06)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Escala tipográfica consistente (tamaño / interlineado / peso). */
export const type = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  } satisfies TextStyle,
  h1: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
  } satisfies TextStyle,
  h2: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.25,
  } satisfies TextStyle,
  h3: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: -0.1,
  } satisfies TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  } satisfies TextStyle,
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  } satisfies TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  } satisfies TextStyle,
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  } satisfies TextStyle,
} as const;

/** Sombra suave multiplataforma. En web se traduce a box-shadow. */
export const shadows = {
  none: {} as ViewStyle,
  card: Platform.select<ViewStyle>({
    web: { boxShadow: '0 1px 2px rgba(15, 31, 28, 0.04), 0 8px 24px rgba(15, 31, 28, 0.05)' },
    default: {
      shadowColor: '#0F1F1C',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  })!,
  floating: Platform.select<ViewStyle>({
    web: { boxShadow: '0 10px 40px rgba(15, 31, 28, 0.14)' },
    default: {
      shadowColor: '#0F1F1C',
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
  })!,
  brand: Platform.select<ViewStyle>({
    web: { boxShadow: '0 8px 22px rgba(15, 118, 110, 0.28)' },
    default: {
      shadowColor: '#0F766E',
      shadowOpacity: 0.3,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  })!,
} as const;

/** Ancho máximo por tipo de contenido: lectura cómoda también en desktop. */
export const layout = {
  content: 880,
  narrow: 560,
  form: 480,
  tabBar: 560,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/** Cursor de puntero solo en web (afecta la sensación de la app en escritorio). */
export const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;
