# Ignite Hubs Careers Hubs: Nuxt + Payload CMS on Azure Static Web Apps

A careers hub where students explore career paths: what each role involves, the skills it needs and how to get there. It is not a job board. Each career path is a page in the **Careers** collection of **Payload CMS**. Pages are prerendered by **Nuxt 4** in GitHub Actions, and served from **Azure Static Web Apps (SWA)**. A small read-only **Azure Functions** API keeps pages up to date between builds.

```
Payload CMS ──(publish hook)──▶ GitHub Actions ──▶ Azure Static Web Apps
 careers collection              discover slugs       /            static HTML
                                 prerender pages      /careers/*   static HTML (+ live re-check)
                                 test + deploy        /api/*       Azure Functions ──▶ Payload
```

See [docs/SPEC-REVIEW.md](docs/SPEC-REVIEW.md) for what changed from the original spec and why.

## Repository layout

```
├── shared/careers/          Code shared by web and api (single source of truth)
│   ├── types.ts             Career / PaginatedCareers contract
│   ├── payload-client.ts    Payload REST client (config, queries, projection)
│   ├── http.ts              Transport-agnostic API handlers (validation, status codes, caching)
│   └── rich-text.ts         Lexical helpers (plain text, excerpts, URL allow-list)
├── web/                     Nuxt 4 site (nuxt generate → web/.output/public)
│   ├── app/                 pages, components, composables, layout
│   ├── server/api/careers/  Local copy of the API for `nuxt dev` and prerendering (not deployed)
│   └── public/staticwebapp.config.json
├── api/                     Azure Functions (Node 22, v4 programming model)
│   ├── src/functions/       careers.ts, career-by-slug.ts (thin adapters)
│   └── test/                Vitest tests for the shared module
├── tools/mock-payload/      Zero-dependency mock Payload server + seed data
├── docs/payload/            Reference Payload collection + rebuild hook
└── .github/workflows/azure-static-web-apps.yml
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/careers?limit=12&page=1` | Published career paths, A–Z by title (`limit` max 50) |
| `GET /api/careers/{slug}` | A single published career path, or `404` |

## Run locally

Requires Node 22+.

```bash
cd web
npm install
cp .env.example .env
```

Start the mock CMS (port 3001) in one terminal:

```bash
npm run mock:payload
```

Start the site in another terminal (http://localhost:3000):

```bash
npm run dev
```

To build the static site exactly as CI does, run `npm run generate`. The output goes to `web/.output/public`.

To use your real Payload instance, set `PAYLOAD_URL` (and `PAYLOAD_API_KEY` if needed) in `web/.env`.

API tests:

```bash
cd api && npm install && npm test
```

To run the real Functions locally, copy `api/local.settings.example.json` to `api/local.settings.json`, run `npm run build && func start` in `api/`, and run `swa start web/.output/public --api-devserver-url http://localhost:7071` with the [SWA CLI](https://azure.github.io/static-web-apps-cli/).

## Configuration

The same variable names are used everywhere.

| Variable | Where | Purpose |
|---|---|---|
| `PAYLOAD_URL` | GitHub secret, SWA app setting, `.env` | Base URL of Payload, e.g. `https://cms.example.com` (**required**) |
| `PAYLOAD_API_KEY` | GitHub secret, SWA app setting, `.env` | API key of a read-only Payload service account (optional if careers are publicly readable) |
| `PAYLOAD_API_KEY_COLLECTION` | GitHub variable, SWA app setting | Auth collection that owns the key (default `users`) |
| `PAYLOAD_CAREERS_COLLECTION` | GitHub variable, SWA app setting | Collection slug (default `careers`) |
| `PAYLOAD_PUBLISHED_FIELD` | GitHub variable, SWA app setting | Checkbox that marks a career path as public (default `published`); empty disables the filter |
| `PAYLOAD_DRAFTS` | GitHub variable, SWA app setting | `true` also filters on `_status = published`, for collections with drafts enabled (default `false`) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | GitHub secret | SWA deployment token |
| `SITE_NAME`, `SITE_URL` | GitHub variables | Site name (default `Ignite Hubs Careers Hubs`), and canonical base URL (e.g. `https://careers.example.com`) |

## Deploy to Azure

1. **Create the GitHub repo** from this folder:
   ```bash
   git init && git add . && git commit -m "Initial commit" && git branch -M main
   ```
   ```bash
   git remote add origin https://github.com/<you>/<repo>.git && git push -u origin main
   ```
2. **Create the Static Web App** in the Azure portal. Use the *Standard* plan if you need a custom domain SLA or bring-your-own Functions; *Free* works for the demo. For **Deployment source**, choose *Other*. The repo already contains its workflow, so don't let Azure generate another one. Then copy the **deployment token** (Overview → *Manage deployment token*).
3. **GitHub → Settings → Secrets and variables → Actions**
   - Secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN`, `PAYLOAD_URL`, `PAYLOAD_API_KEY` (optional).
   - Variables (optional): `SITE_NAME`, `SITE_URL`, `PAYLOAD_PUBLISHED_FIELD`, `PAYLOAD_DRAFTS`, `PAYLOAD_CAREERS_COLLECTION`, `PAYLOAD_API_KEY_COLLECTION`.
4. **Azure portal → your Static Web App → Settings → Environment variables:** add `PAYLOAD_URL` and `PAYLOAD_API_KEY` (plus any of the optional settings). The Functions read these at runtime.
5. **Run the workflow.** Push to `main`, or use *Actions → Build and deploy → Run workflow*. Pull requests get their own preview environment.
6. **(Recommended) Automatic rebuilds on publish:** add `docs/payload/triggerSiteRebuild.ts` to the careers collection in Payload. Then set `GITHUB_REPOSITORY` and `GITHUB_DISPATCH_TOKEN` (a fine-grained PAT with *Contents: read and write* on this repo) in Payload's environment.

## How content freshness works

| Change in Payload | Visible on the site |
|---|---|
| Career path published | Reachable immediately at `/careers/{slug}` (rendered client-side from the API). Fully prerendered, listed and indexed after the rebuild the publish hook triggers. |
| Career path edited | Updated on page load (live re-check), and in the HTML after the rebuild. |
| Career path unpublished | A "no longer listed" notice appears on page load. Removed from the site after the rebuild. |

## Payload requirements

The app expects a `careers` collection with these fields: `title`, `slug`, `content` and a `published` checkbox. `content` may be an HTML string (as in the demo instance), plain text or Lexical rich text. HTML is rendered through an allow-list, not `v-html`: headings, paragraphs, lists, quotes, links and basic formatting are kept, and scripts, styles and attributes are dropped. The first `<p>` is used as the summary on cards and in meta tags. Any other fields in the collection are ignored. A ready-to-use definition is in [docs/payload/Careers.ts](docs/payload/Careers.ts).
