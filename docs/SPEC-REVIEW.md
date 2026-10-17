# Spec review: "Nuxt demo app integrated with Payload CMS instance"

I reviewed the spec before implementing it. Its overall shape is sound: a static Nuxt site on Azure Static Web Apps (SWA), a read-only Azure Functions API in front of Payload, and build-time discovery of vacancy slugs. Several parts would not work as written, though, and some could be improved. This document lists what changed and why.

## Defects in the spec (would break the build or deployment)

| # | Spec | Problem | Fix |
|---|------|---------|-----|
| 1 | Pages call `useFetch('/api/careers')`, and the site is built with `nuxt generate` | During static generation `/api/careers` doesn't exist: the Azure Function is deployed only *after* the build. The spec warns about this in §7 but its own composables do exactly that. Every page would render empty, and `[slug].vue` would throw a 404 and fail the build. | Added **Nitro server routes** (`web/server/api/careers/*`) that mirror the Functions contract. While prerendering (and in `nuxt dev`) `/api/careers` resolves in-process and calls Payload directly. These routes are not deployed. In production `/api/*` is served by Azure Functions. The composables stay one-liners. |
| 2 | §7 describes a route-manifest script but doesn't implement it | Nuxt can't discover slugs beyond the links it crawls. The list page shows only the first page of vacancies. | Implemented with Nuxt's `prerender:routes` hook in `nuxt.config.ts`. It pages through Payload and adds `/careers/{slug}` for every published vacancy. No extra script or manifest file. |
| 3 | `staticwebapp.config.json` at the repo root | When the app is built in CI and uploaded with `skip_app_build`, SWA reads the config from the **app artifact folder**, so a root file is ignored. | Moved to `web/public/`, which Nuxt copies into `.output/public`. |
| 4 | API compiled by SWA's Oryx build | The spec doesn't say how the API is built. Oryx builds only the `api/` folder, so the code shared with the frontend wouldn't be tested in CI. | The workflow builds, typechecks and **tests** the API itself (esbuild bundle), prunes dev dependencies and deploys with `skip_api_build: true`. |
| 5 | Auth header `Authorization: JWT <token>` | A Payload user JWT expires (2 h by default), so builds and the API would start failing with 401/403. | Uses Payload **API keys** (`<collection> API-Key <key>`), which don't expire, from a read-only service account. The env vars are `PAYLOAD_API_KEY` and `PAYLOAD_API_KEY_COLLECTION`. |

## Architecture and code-quality improvements

1. **Single source of truth.** The spec defines `Career` and `PaginatedCareers` twice (in `web/types` and `api/services`). They now live in `shared/careers/` together with the Payload client and the HTTP handlers. Azure Functions and the Nitro routes are ~10-line adapters over the same `handleListCareers` and `handleGetCareer`, so the dev, build and production APIs can't drift apart.
2. **Response projection.** The spec returned Payload documents as-is. `toCareer()` now whitelists the public fields, so a new internal field in Payload (salary bands, notes) can't leak through the API. Requests also send `depth=0`, so relationships aren't populated.
3. **Input validation.** Slugs must match `^[a-z0-9]+(-[a-z0-9]+)*$` (the spec only checked length). `limit` and `page` are parsed with `parseInt` and clamped.
4. **Error semantics.** Misconfiguration returns 500 and an upstream Payload failure returns 502. Errors are never cached. The vacancy page returns a real 404 only for "not found". Any other failure aborts `nuxt generate` instead of publishing a broken page.
5. **Configurable without code changes:** collection slug, drafts on/off (the spec's "change the filter accordingly"), and request timeout.
6. **Freshness between builds** (the spec's closing recommendation):
   - Payload `afterChange`/`afterDelete` hook → GitHub `repository_dispatch` → rebuild (`docs/payload/triggerSiteRebuild.ts`).
   - A nightly scheduled rebuild drops vacancies past their closing date.
   - After hydration, pages re-validate against the live API: withdrawn vacancies show a "no longer accepting applications" notice, and list pages refresh.
   - A vacancy published **after** the last build is still reachable. SWA serves Nuxt's `404.html` SPA shell for unknown paths, and the page fetches the vacancy from the Functions API. Truly unknown slugs still get HTTP 404.
7. **Rich text.** The spec rendered `description` only when it was a plain string, but Payload 3 stores rich text as Lexical JSON. `RichText.vue` renders Lexical safely: no `v-html`, link URLs are allow-listed, and heading levels are adjusted. Excerpts and meta descriptions come from the first paragraph.
8. **Added the recommended fields:** `applicationUrl` (Apply button) and `closingDate` (shown, plus a "Closed" badge). Time-based UI renders only after mount, which avoids build-time staleness and hydration mismatches.
9. **SEO and accessibility.** Each vacancy has schema.org `JobPosting` JSON-LD (eligible for Google for Jobs), an optional canonical URL, one link per card (the spec had two identical links per card), a skip link, and screen-reader labels.
10. **Security headers.** CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`. Hashed `/_nuxt/*` assets are cached as immutable.
11. **Pagination.** The spec silently capped lists at 20. The vacancy list now has "Load more", backed by the paginated API.
12. **Tests and tooling.** Vitest covers the shared module (config, query building, projection, validation, error mapping, slug discovery, rich text). The repo includes a zero-dependency **mock Payload server**, so the whole site runs locally without a CMS.

## Deliberate deviations from the spec's folder structure

- `web/` uses the Nuxt 4 `app/` source directory (`web/app/pages`, `web/app/components`, …), which is the Nuxt 4 default.
- `web/types/career.ts` and `api/src/services/payload.ts` → `shared/careers/{types,payload-client,http,rich-text}.ts`.
- `api/src/index.ts` is the single bundle entry that registers both functions.
