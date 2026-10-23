import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Documento raíz de la versión web (solo se ejecuta en Node durante el build).
 * Pinta el fondo de la app desde el primer frame y suaviza las fuentes para
 * que la web se sienta igual de pulida que la app nativa.
 */
export default function Root({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();

  return (
    <html lang="es" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0F766E" />
        <meta name="color-scheme" content="light" />
        <meta
          name="description"
          content="Descubre tiendas cerca de ti, pide a domicilio o recoge en tienda. Comercio local, sin comisiones."
        />
        <meta property="og:title" content="ClubSellBuy · Tu barrio, a un toque" />
        <meta
          property="og:description"
          content="Descubre tiendas cerca de ti, pide a domicilio o recoge en tienda. Comercio local, sin comisiones."
        />
        <meta property="og:type" content="website" />
        <title>ClubSellBuy · Tu barrio, a un toque</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: rootStyles }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}

const rootStyles = `
  html, body, #root {
    background-color: #F5F8F7;
  }
  body {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  ::selection {
    background-color: #CCFBF1;
    color: #0F1F1C;
  }
`;
