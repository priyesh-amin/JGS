# Cloudflare local setup

This Vite/React project is configured for Cloudflare Pages. Pages Functions
use the `DB` D1 binding. Real `wrangler.jsonc` and
`wrangler.fixture-sync.jsonc` files are ignored local/provider configuration;
the reviewed placeholder shapes are in `wrangler.booking.example.jsonc` and
`wrangler.fixture-sync.example.jsonc`.

Cloudflare API tokens and account identifiers must not be saved in this
repository or pasted into chat. For local use, authenticate Wrangler outside
the project:

```powershell
npx wrangler login
```

Complete the authorization in the browser. To verify authentication without
changing Cloudflare resources, run `npx wrangler whoami`.

Do not create a project-local Cloudflare credential file. Real `.dev.vars`
values are local only; `.dev.vars.example` contains placeholders.

Run the release packaging check without contacting Cloudflare:

```powershell
python scripts/deploy_pages.py
```

This creates a clean temporary copy, uses Node 24 and `npm ci`, runs the full
check, and compiles the root `functions/` directory into a Pages Functions
bundle. The tool is dry-run by default. `--deploy` is an explicit external
gate, and production additionally requires `--production
--approve-production`. The three compatibility wrappers in the workspace
`execution` folder call this same reviewed tool and no longer load
`execution/cloudflare.env`.

GitHub Actions references `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` through GitHub repository secrets. Enter those values
directly in GitHub's secrets UI, never in source control or chat.

No deployment is performed as part of local setup or the default packaging
check.
