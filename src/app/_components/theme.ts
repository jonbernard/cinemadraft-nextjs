'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  colorSchemes: {
    light: true,
    dark: true,
  },
  typography: {
    fontFamily: 'var(--font-inter)',
  },
});

export default theme;
