# JGS release runbook

## Routine release

1. Merge or push the approved application change to main.
2. **Deploy JGS Application** runs the policy check, lint, tests, builds and Cloudflare Pages deployment.
3. The workflow serialises production releases and cancels an older in-flight release when a newer main commit is available.
4. **JGS Production Smoke** runs separately after a successful deployment and checks the production homepage and /api/status with retries.

A failed smoke check means the deployed application needs investigation; it does not mean the Pages upload failed.

## Keep outside the routine release

The routine workflow must not call Cloudflare D1 administration or Workers schedule administration APIs. Those operations require owner-level access and can invalidate an otherwise successful production deployment.

The old jgs-fixture-sync schedule is a one-time Cloudflare owner task. The website-management activation is a one-time authenticated Admin action using the existing D1 binding.

## Failure triage

- **Policy, lint, tests or build:** application or repository change; fix the commit.
- **Pages deployment:** Cloudflare Pages credentials, project or provider issue; inspect the Wrangler step.
- **Smoke check:** production routing, custom-domain propagation or API availability; inspect the reported HTTP status and response.
- **Owner-only cleanup:** perform separately with an appropriately authorised Cloudflare account; never add it back to the routine release gate.

Chetan's operating path remains the website Admin area. Spreadsheets are retained as historical references or optional exports.
