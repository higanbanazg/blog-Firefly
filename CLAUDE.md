# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Firefly is a feature-rich static blog theme built on **Astro 7** with **Svelte 5** for interactive components. It's a fork of [Fuwari](https://github.com/saicaca/fuwari) extended with extensive features. Primary language is Chinese (Simplified) with i18n for en, zh_TW, ja, ko, ru.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server at `localhost:4321` |
| `pnpm build` | Production build (LQIPs → VNDB covers → Astro build → font subsetting → Pagefind indexing) |
| `pnpm preview` | Preview production build |
| `pnpm check` | `astro check` for type/error checking |
| `pnpm type-check` | `tsc --noEmit --isolatedDeclarations` (covers `src/` and `scripts/`) |
| `pnpm lint` | Biome lint + auto-fix |
| `pnpm format` | Biome format |
| `pnpm new-post <filename>` | Scaffold a new blog post |
| `pnpm new-dynamic` (`new-d`) | Scaffold a new dynamic (microblog) entry |
| `pnpm lqips` | Regenerate LQIP data into `src/constants/lqips.json` |
| `pnpm indexnow [url ...]` | Push URLs to IndexNow (Bing/Yandex/Seznam/Naver — not Google); no args = whole live sitemap |
| `pnpm admin` | Local-only content admin at `127.0.0.1:4322` (posts, dynamics, friends) |

Package manager is **pnpm** (enforced). Node.js >= 22 required.

## Architecture

### Astro + Svelte Hybrid

- `.astro` components for static content and layouts
- `.svelte` components for interactive UI (search, settings, pagination, archive) — mounted with `client:load` or `client:visible`
- Swup.js handles SPA-like page transitions with multiple container targets

### Configuration-Driven

All features are toggled/configured via TypeScript files in `src/config/`, exported through the barrel at `src/config/index.ts`. Key configs:

- `siteConfig.ts` — core site settings, theme, pagination
- `sidebarConfig.ts` — sidebar layout (left/right/both, widget ordering)
- `commentConfig.ts`, `analyticsConfig.ts`, `fontConfig.ts`, etc.

Two exceptions to the TS-only rule, both driven by `pnpm admin`: friend-link *data* lives in `src/config/friends.json` (`friendsConfig.ts` only types and sorts it), and sidebar ad-slot data lives in `src/config/ads.json` (`sidebarConfig.ts` imports it and splices it into the component arrays). The split exists so the admin can rewrite them without parsing a TS literal. Edit either the JSON directly or the admin UI.

### Layout System

- `Layout.astro` — base HTML shell (head, body, theme init, analytics, Swup hooks)
- `MainGridLayout.astro` — full page grid with sidebar(s), navbar, wallpaper, footer

### Content Collections

Defined in `src/content.config.ts`:
- `posts` — blog posts (`.md`/`.mdx`) with frontmatter: title, published, tags, category, draft, pinned, password, comment, etc.
- `spec` — special pages (about, guestbook)
- `dynamic` — microblog entries (`.md`) with frontmatter: published, pinned, location

### Key Directories

- `src/components/` — organized by domain: `analytics/`, `comment/`, `common/`, `controls/`, `features/`, `layout/`, `misc/`, `pages/`, `widget/`
- `src/plugins/` — 15 custom remark/rehype plugins (Mermaid, PlantUML, KaTeX, GitHub cards, reading time, wiki links, etc.)
- `src/i18n/` — translation keys in `i18nKey.ts`, language files in `languages/*.ts`, lookup via `translation.ts`
- `src/utils/` — content sorting, crypto (encrypted posts), date formatting, image processing/LQIP, TOC generation
- `src/pages/` — Astro file-based routing
- `scripts/` — build-time utilities (`generate-lqips.ts`, `generate-vndb-covers.ts`, `subset-fonts.ts`, `new-post.js`, `new-dynamic.js`) and ops one-offs (`indexnow.ts`)
- `scripts/admin/` — the `pnpm admin` content backend (`server.ts`) plus its no-build UI (`ui.html` + `ui.js`)

### Path Aliases (tsconfig.json)

`@components/*`, `@assets/*`, `@constants/*`, `@utils/*`, `@i18n/*`, `@layouts/*` → `./src/<dir>/*`; `@/*` → `./src/*`

## Code Style

- **Biome** enforces: tab indentation, double quotes, recommended lint rules
- Relaxed rules for `.svelte`/`.astro`/`.vue` files (`useConst`, `useImportType`, `noUnusedVariables`, `noUnusedImports` off)
- `pnpm lint`/`pnpm format` cover both `./src` and `./scripts`; both are clean and `pnpm lint` exits 0
- `scripts/subset-font.d.ts` is a hand-written ambient declaration for the untyped `subset-font` package
- Commit convention: **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.)

## Build Pipeline

Multi-step: `scripts/generate-lqips.ts` → `scripts/generate-vndb-covers.ts` → `astro build` → `scripts/subset-fonts.ts` → `scripts/minify-inline-scripts.ts` → `pagefind --site dist`

LQIP data is generated into `src/constants/lqips.json` and committed — regenerate with `pnpm lqips`. Icon data lives in `src/constants/icons-data.json` (committed, Biome-ignored, consumed by `src/components/common/Icon.svelte`) but has no generator script in the current build.

`generate-vndb-covers.ts` downloads VNDB cover art into `public/vndb-covers/` (gitignored, skips files that already exist). It no-ops unless `siteConfig.vndb` has a `userId`, `downloadCovers: true`, and `mode: "static"`.

## Content Admin (`pnpm admin`)

A local-only editor for posts, dynamics, and friend links. `scripts/admin/server.ts` is a plain Node HTTP server; `ui.html` + `ui.js` are served as-is with no build step.

**Why it is a script and not an Astro route.** Cloudflare Workers has no `fs`. Anything under `src/pages/` that reads or writes the content directory breaks the production build, so the admin lives outside the Astro app entirely and never ships to `dist/`.

**Why the body is a raw `<textarea>`.** This repo has 15 custom remark/rehype plugins (Mermaid, PlantUML, KaTeX, wiki links, admonitions, image grid). A WYSIWYG or AST-backed editor re-serializes Markdown on save and mangles syntax it has no node type for. The admin never parses the body — it moves text verbatim. Frontmatter is rebuilt from typed fields; the existing post round-trips read→save byte-identically.

**Security model.** Binds `127.0.0.1` only. Every `/api/` call needs a per-process random token, injected into the page at request time and sent as `X-Admin-Token`, plus an `Origin` check — so a random page in the same browser cannot drive it. All paths are validated with `insideDir()` before any read, write, or delete.

**Image routing differs by kind, and this matters.** Post images go to `src/content/posts/images/<dir>/` and are referenced relatively (`./images/<dir>/x.avif`) so Astro optimizes them. Dynamic images go to `public/dynamic-images/` and are referenced site-absolutely (`/dynamic-images/x.avif`), because `src/utils/dynamic-data.ts` extracts them by regex and passes `src` straight into `<img>` with no optimization. The directory is `dynamic-images`, not `dynamic`, to avoid colliding with the `/dynamic/` page route. Ad images are a third case: `public/slot-images/`, referenced as `/slot-images/x.avif`. The name deliberately avoids `ads`/`banner`/`promo` — uBlock and AdGuard match those substrings in a URL path, so the image would vanish for readers while looking fine locally.

**Uploads are re-encoded to AVIF** (`sharp`, quality 60, width capped at 1600 with no upscaling, EXIF rotation baked in). The original filename is kept — only the extension changes. Three types pass through untouched: `.gif` (sharp would keep only the first frame), `.svg` (rasterizing a vector destroys it), and `.avif` (already the target; re-encoding is lossy-on-lossy). If the AVIF comes out no smaller than the input, the original is kept instead. Encoding failures fall back to the raw bytes rather than failing the upload.

**A post's image directory is not necessarily its slug.** `3x-ui-vless-reality.md` keeps its images in `images/3x-ui/`. The admin therefore exposes an editable 图片目录 field: on open, `detectImgDir()` in `ui.js` scans the body for `./images/<dir>/` and prefills the most common match, falling back to the slug for new posts. When the detected directory differs from the slug it is marked touched so later slug edits don't clobber it. The server still runs the value through `toSlug()` (which flattens `../` to nothing) and then `insideDir()`, so a hand-typed path can't escape `POST_IMAGES_DIR`.

**Dynamic timestamps must carry the `+08:00` offset.** `published` is `z.date()`; an offset-less `2026-08-20 17:23:13` parses as UTC and then renders 8 hours late. The server writes full ISO strings and preserves the raw `published` line on read rather than round-tripping through a `Date`.

**Publishing is scoped on purpose.** The 发布上线 panel runs `git add --` against `src/content`, `src/config/friends.json`, `src/config/ads.json`, `public/dynamic-images`, and `public/slot-images` only — never `git add -A`. Anything else you have in progress shows in a separate "not included" list and stays uncommitted.

**Ad slots split flat, then get translated back.** `ads.json` holds a *flat* record per slot (`side`, `position`, `title`, `imgSrc`, `linkText`, `fullBleed`, …), not the theme's nested `AdConfig`. Flat is what the admin can serialize field-by-field and validate per-input; `sidebarConfig.ts` converts flat → nested via `toAdWidget()` and `adsFor(side)`, dropping empty fields so `Advertisement.astro` still takes its own "not configured → don't render" branches. The component itself is untouched upstream code.

`displayCount` ("show this ad at most N times per visitor") is deliberately not exposed; the server hardcodes `-1`. Its localStorage key is `"ad-display-" + widgetId`, and `widgetId` is `Math.random()` generated per render and baked into static HTML — so the count is per-page, resets on every build, and increments again on Swup navigations. It cannot limit anything. The theme's own two example slots also shipped `-1`.

Validation only fires on slots with `enabled: true`. A slot with nothing but a note is a legitimate draft — it never reaches the page — so half-finished rows save fine and only going live requires a title, body, or image.

`friends.json` is written field-by-field rather than via `JSON.stringify(x, null, "\t")`, which would expand `"tags": ["Blog"]` onto three lines and fight Biome's formatter on every save.

## Deployment

- **Vercel** (default, `vercel.json`)
- **Cloudflare Workers** (`wrangler.jsonc`, set `CF_WORKERS` env var)
- Static output to `dist/`

`scripts/indexnow.ts` is a **post-deploy** op, not part of the build: it reads the *live* sitemap (not `dist/`) and POSTs the URLs to IndexNow. The key is hardcoded in the script and must stay identical to `public/<key>.txt` — that public file is how IndexNow verifies domain ownership, so the key is meant to be public. The script self-checks that the key file is reachable before submitting.

