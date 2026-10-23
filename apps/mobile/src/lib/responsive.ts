import { useWindowDimensions } from 'react-native';

/**
 * Breakpoints compartidos por web y mobile. En móvil manda el espacio real;
 * en pantallas grandes limitamos el ancho para que no queden líneas eternas.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isCompact = width < 380;
  const isTablet = width >= 720;
  const isDesktop = width >= 1024;
  const gutter = isCompact ? 16 : isTablet ? 28 : 20;

  return {
    width,
    height,
    isCompact,
    isTablet,
    isDesktop,
    gutter,
    columns: isDesktop ? 3 : isTablet ? 2 : 1,
  };
}
