import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from '@mui/icons-material';
import { IconButton, useMediaQuery } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';

export default function ColorMode() {
  const { mode, setMode } = useColorScheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  console.log(prefersDarkMode);

  if (!mode) {
    return null;
  }

  const onChange = () => {
    if (mode === 'system') return setMode(prefersDarkMode ? 'light' : 'dark');

    return setMode(mode === 'light' ? 'dark' : 'light');
  };

  return (
    <IconButton onClick={onChange}>
      {mode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
    </IconButton>
  );
}
