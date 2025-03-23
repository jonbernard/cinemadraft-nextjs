import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  modularizeImports: {
    lodash: {
      transform: 'lodash/{{member}}',
      preventFullImport: true,
    },
    '@mui/material': {
      transform: '@mui/material/{{member}}',
      preventFullImport: true,
    },
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}',
      preventFullImport: true,
    },
    '@mui/styles': {
      transform: '@mui/styles/{{member}}',
      preventFullImport: true,
    },
    '@mui/lab': {
      transform: '@mui/lab/{{member}}',
      preventFullImport: true,
    },
  },
};

export default nextConfig;
