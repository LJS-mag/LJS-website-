# Literature & Journalism Society website

Static site (Astro). No database and no server: all content is plain files in `content/`, and the site is rebuilt and published by GitHub Actions.

## Run it
```bash
npm install
npm run dev        # http://localhost:4321 (forms run in "dev mode": nothing is sent)
npm run build      # builds to dist/ and validates every content file
```
Node 20.3 or newer.

## Where things live
| What | Where |
|---|---|
| Team (names, roles, photos, leader bios) | `content/team.json`, photos in `public/media/team/` |
| Issues (title, date, blurb, page images) | `content/issues.json`, page images in `public/issues/<slug>/` |
| Journal posts | `content/posts/*.md` |
| Approved reviews | `content/reviews.json` |
| Site text, Instagram, contact email, form key, open/closed | `content/settings.json` |
| Design (colours, type, components) | `src/styles/global.css` (tokens at the top) |

Every file is validated at build time by `src/content.config.ts`. A mistake fails the build and the live site keeps its last good version.

## Palette
Linen `#E7E2D7`, Fog `#BFBCB2` (backgrounds); Wine `#431B2D`, Eggplant `#251821` (accents); text black.

## Before launch (placeholders to replace)
- Anything marked `"sample": true` in `content/` is placeholder content: issues, posts and reviews. Replace with real content, then remove those entries.
- `settings.contactEmail` and `settings.formRelayKey` are empty. Until a key is set, the review and apply forms show "open soon" in production. Get a free key at web3forms.com using the society's email address.
- `settings.stats` is empty on purpose: add real numbers only (for example `{ "value": "4", "label": "Issues published" }`).
- Confirm with the society: the "Youth Gazette" wording in the team text, and the spelling of "Muhammad Yahya Khan" and "WJH".

## Admin page
`/admin/` is a page (installable on a phone) that edits the files in `content/` and `public/` through the GitHub API and publishes them as one commit. Code is in `src/admin/`. Setup, daily use and troubleshooting for the society are in `docs/HANDOVER.md`.

To test it without a real GitHub account, run the mock server from the parent folder: `node tools/mock-github/server.cjs <copy-of-this-repo> 5195 test-token`, then in the admin setup choose Advanced and set the GitHub address to `http://localhost:5195`.

## Deploy (GitHub Pages)
1. The society's GitHub account owns the repo. In Settings > Pages, set Source to "GitHub Actions".
2. Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes.
3. With a custom domain, add repository variables `SITE_URL` (for example `https://ljs.org`) and `BASE_PATH` (`/`).

## Hero video
`public/media/hero-ink.mp4` and `hero-ink.jpg` are rendered by `tools/ink-video/` in the parent folder (see its README).
