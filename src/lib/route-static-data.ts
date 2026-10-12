/**
 * Flags a route can set in `staticData` for the app layout to read (`useMatches` in `src/routes/_app.tsx`).
 * `wide`: on screens of 1280px and up the content column makes room for a sticky contents list beside the text;
 * the text column itself stays the app's usual width. Content pages built on `DocPage` set it.
 */
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    wide?: boolean
  }
}

export {}
