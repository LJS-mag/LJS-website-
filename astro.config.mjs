// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL / BASE_PATH are set by the GitHub Actions deploy (e.g. https://society.github.io and /ljs-site).
// Locally they default to the dev server root.
const site = process.env.SITE_URL || 'http://localhost:4321';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
  integrations: [sitemap({ filter: (page) => !page.includes('/admin/') })],
});
