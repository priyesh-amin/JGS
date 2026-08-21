# Project delivery and orchestration charter

## Purpose

This charter governs coordinated delivery of the Jaguar Golf Society website. It supplements the package-specific architecture, operations, risk, and verification documents; those documents remain authoritative for their technical subjects. The maintained [source and decision register](./SOURCE_AND_DECISION_REGISTER.md) records verified source roles, decisions, provenance, and unresolved gates so the coordinator checks existing evidence before requesting input.

## Coordinator responsibility

The coordinator owns the current scope, work-package order, task boundaries, dependencies, human gates, and final decision pack. The coordinator keeps one coherent view of verified facts, avoids duplicate investigation, protects unrelated work, and does not advance a later package until the current package meets its acceptance criteria or reaches a documented human gate.

## Bounded roles and minimal parallelism

- Use the smallest number of agents that materially reduces elapsed time or risk.
- Give each agent one bounded, non-overlapping task with a named output and clear stop condition.
- Keep one writer responsible for any shared implementation area. Other agents may inspect or test it but must not make overlapping edits.
- Assign an independent reviewer after the writer's implementation and checks are stable. The reviewer tests assumptions, security boundaries, data safety, regressions, and release evidence without relying on the writer's conclusions.
- The coordinator resolves findings, reruns affected checks, and records the disposition before release.

## Controlling work-package sequence

1. **WP1 — Fixture Data Foundation**
2. **WP2 — Chetan Operational Readiness**
3. **WP3 — Member Booking and Cancellation**
4. **WP4 — Booking Outputs and Live Leaderboards**
5. **WP5 — Dashboard, Production Acceptance and Handover**
6. **Backlog Enhancements**

A later package may be researched only when needed to expose a dependency. Its implementation does not begin before the preceding package is accepted or formally gated. Operational spreadsheet dashboard links remain WP5 scope.

## WP5 operations dashboard and handover acceptance

WP5 is not accepted until the administrator dashboard and handover include a simple operations guide usable by Priyesh, Chetan, or a new committee volunteer. The guide must:

- explain in plain English the purpose, owner, and normal use of each approved authoritative or operational sheet covering fixtures, booking management and outputs, payments and balances, Player of the Year and other leaderboards, and member-portal data;
- provide direct administrator-only links to each verified sheet, with clear labels and safe external-link behaviour;
- distinguish verified sources from missing or unconfirmed sheets instead of inventing links or ownership;
- include a clear visual flowchart showing source data → synchronisation → website → operational outputs, and identify who maintains each step;
- state that D1 is canonical for accounts and website bookings, while sheets are authoritative only for their designated source data;
- make clear that booking changes flow from the website/D1 to approved outputs and are not maintained through two-way spreadsheet editing;
- include the minimum routine checks, sync/error interpretation, and escalation or recovery steps needed for a future maintainer.

Acceptance evidence must confirm that an administrator can find every approved operational source, understand ownership and data direction without technical assistance, and follow the guide without exposing secrets or receiving broader Google access than intended. This requirement is documentation and dashboard scope for WP5 only; it does not authorize implementation or deployment during earlier packages.

## Human gates and data safety

Stop and request the appropriate owner decision when work requires:

- business meaning, fixture details, booking windows, publication status, member data, or other facts that cannot be verified from an approved authoritative source;
- private credentials, passwords, tokens, account recovery input, Google authorization, or a verified sharing identity;
- creation or modification of production accounts, bookings, attendance, spreadsheet sharing, DNS, domains, or other externally consequential state beyond existing authorization;
- acceptance of a material security, data-loss, or operational trade-off.

Private values are entered only through an approved masked or provider-owned flow. They are never requested in chat, logged, persisted in helper files, or included in reports. Production records are never fabricated: use automated tests, isolated databases, preview deployments, and approved non-production accounts instead.

## Production and deployment gate

Before a production change, the coordinator must confirm:

1. scope and authorization are current;
2. the writer's targeted tests, lint, and clean production build pass;
3. migration and rollback/backup needs are understood;
4. an independent security/QA review has no unresolved release blocker;
5. secrets remain provider-managed and source data remains authoritative;
6. the deployment is the reviewed build/configuration, with unrelated changes excluded.

After deployment, verify the public route and affected protected behavior, remote bindings/migrations where relevant, production data invariants, logs or health signals, and the intended fail-closed behavior. Do not claim completion from a successful upload alone.

## Evidence and retrospective record

Each package keeps a concise evidence record in `docs/` or its relevant subfolder. Record:

- scope delivered and explicitly deferred;
- writer and independent-review boundaries;
- commands/checks run and their outcomes;
- preview and production verification results;
- production mutations and preserved invariants;
- human decisions, gates, and remaining owner actions;
- reviewer findings and their dispositions;
- incidents, near misses, or assumptions corrected;
- what reduced risk or rework and should be reused;
- what caused delay or ambiguity and should change next time.

At package acceptance, the coordinator turns these facts into one concise decision pack. At project handover, consolidate the package records into a retrospective suitable for adapting this orchestration model to another project; do not convert it into a global setting or reusable Codex skill without a separate review and explicit approval.