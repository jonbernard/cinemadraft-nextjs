import type { StorybookConfig } from '@storybook/nextjs-vite';

/**
 * Storybook 10 is ESM-only, so every file in this directory is ESM.
 *
 * The Vite framework rather than the Webpack one: this project has no custom
 * Webpack or Babel config (Next 16 uses Turbopack), which is the documented
 * condition for the Vite variant, and it is the only variant that could ever
 * run the Vitest addon.
 */
const config: StorybookConfig = {
  stories: [
    '../.storybook/**/*.mdx',
    '../components/**/*.stories.@(ts|tsx)',
    '../theme/**/*.stories.@(ts|tsx)',
  ],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: { name: '@storybook/nextjs-vite', options: {} },
  staticDirs: ['../public'],
};

export default config;
