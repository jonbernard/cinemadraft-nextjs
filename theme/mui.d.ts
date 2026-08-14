/**
 * Tells TypeScript this app runs MUI with CSS variables enabled.
 *
 * `createTheme` is declared as returning a plain `Theme` — its own source
 * carries the comment "cast type to skip module augmentation test" — so
 * without this augmentation `theme.colorSchemes`, `theme.defaultColorScheme`
 * and `theme.colorSchemeSelector` are invisible to the compiler even though
 * they exist at runtime. That would push every consumer toward an `as any`,
 * which is exactly the kind of cast that later hides a real mistake.
 *
 * This is the mechanism MUI documents for the `cssVariables` option, not a
 * workaround.
 */
declare module '@mui/material/styles' {
  interface CssThemeVariables {
    enabled: true;
  }
}

export {};
