# Marquise

A French-first study companion for a small, invite-only university group. Marquise brings course materials, editable flashcards, spaced review and exam preparation into one calm workspace.

Built with React, TypeScript, Vinext, Cloudflare Workers, D1/SQLite and R2. This is a working pilot with explicit limits, not a claim of production-scale readiness.

## Try it locally — no AI subscription or key needed

Use Node 22.16+ (see `.nvmrc`) and npm. From a clean checkout:

```sh
npm ci
npm run demo
```

Open **http://localhost:5173**. The command builds the Worker, applies local schema files, and starts a loopback-only demo with fictional data and paid AI disabled. Local data stays in ignored `.wrangler/`; stop with Ctrl+C. Keep port 5173 available.

Follow the [three-minute demo](docs/DEMO.md), using the included [sample CSV](docs/demo-cards.csv). The [live pilot](https://marquise.faroukoussaada.chatgpt.site) requires an invitation; repository access does not grant access to student data.

## What works

- Private courses, multi-file PDF/PPTX uploads, exams and adjustable study availability.
- Coordinated study plans that report capacity shortages and preserve completed work.
- Editable, source-referenced draft cards with a target of 1–120 per generation, saved in batches with pause/resume.
- CSV import/export (up to 500 cards per deck), manual editing and spaced recall ratings without AI calls.
- Course-grounded tutoring with conditional, labeled external search when configured.
- Snapshot deck sharing with separate review progress and no sharing of source documents or chats.
- Owner-controlled AI allowances, pauses, request/concurrency limits and estimated usage reporting.
- Responsive French UI, two themes, an in-app guide and installable web-app metadata.

Fresh checkouts disable AI. The live pilot has been tested with real provider calls; local demos never pretend to generate an AI answer. API usage is billed separately from ChatGPT subscriptions.

## Development and validation

```sh
npm run check      # TypeScript, domain tests, production build
npm run db:local   # After building: apply schema to local D1
npm run dev        # Development server and local mock sign-in
```

`npm test` covers scheduling capacity, review timing, citation matching, generation planning, CSV handling and upload batches. It also generates the ignored reservation SQL used by the local integration suite.

With `npm run demo` running in another terminal, and after `npm test`:

```sh
python3 tests/api_test.py
```

Additional integration suites (`membership_test.py`, `upload_api_test.py`, `generation_api_test.py`) require separately configured loopback Workers on the ports documented in their source. They exercise member isolation, sharing, private files and AI admission. They are not included in CI yet. Never aim them at production.

GitHub Actions runs `npm run check` on pushes and pull requests. Manual pilot checks have exercised saved reviews, PDF/PPTX references, generation pause/reload/resume and responsive layouts. Physical-device installation and comprehensive browser automation remain future work.

## Optional AI and hosting setup

Read [SECURITY.md](SECURITY.md) before deploying anywhere. The production authentication adapter requires the trusted Sites dispatcher; directly exposing the Worker is unsafe without replacing that adapter.

Copy `.env.example` to `.env` only if you need local configuration. Production secrets are configured separately through the hosting provider. Supply `OWNER_EMAIL`, a server-only `OPENAI_API_KEY`, `AI_MODEL` and verified USD token rates. Keep `AI_ENABLED=false` until paid usage is approved. Set the same model in owner administration, synchronize its rates, then unpause. A model whose rates do not match the runtime configuration remains unavailable.

The default allowance is CA$12/month, with admission at 85%, 60 requests/member/month, two concurrent requests globally, one per member, and bounded output. These are application controls, not a guarantee about the provider's invoice. Search tool charges, currency assumptions, taxes and hosting/storage costs are separate. Saved cards, review calculations and plans do not call AI.

The included `.openai/hosting.json` identifies the original pilot. Forks must create their own hosting registration; local demo commands do not deploy anything. This repository intentionally does not auto-deploy from GitHub.

## Design decisions and limits

See [architecture and engineering review](docs/ARCHITECTURE.md), [demo/interview notes](docs/DEMO.md), [security boundaries](SECURITY.md) and [contributing](CONTRIBUTING.md).

Diagrams are retained in originals but not interpreted automatically. Retrieval is lexical and bounded; citations do not establish that every interpretation is correct. Scheduling uses adjustable estimates. Per-user structured data is limited to 1.5 MB, with up to 40 documents. Shared decks do not sync later edits. Private content is not cached offline.

Developed with AI assistance, with implementation decisions and validation documented here. The project retains third-party license notices; no blanket project reuse license has been selected.
