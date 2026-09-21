# Three-minute demo

Run `npm ci`, then `npm run demo`. Open http://localhost:5173. Use fictional sample data; never screen-share a student's account or course files. No key or paid service is needed. The demo explicitly disables paid AI.

| Time | Show | Explain |
| --- | --- | --- |
| 0:00–0:20 | French dashboard | A small university group needs one place for flashcards and exam preparation. |
| 0:20–1:15 | Mes fiches → Importer un CSV → `docs/demo-cards.csv` | Preview, edit and study cards without an AI call. Source-less sample cards are not professor-verified material. |
| 1:15–1:40 | Réviser → reveal → recall rating → reload | Review dates and progress are saved independently for each learner. |
| 1:40–2:20 | Mon planning and upcoming exams | Available hours constrain the combined workload across courses. Estimates are adjustable; shortages are made visible. |
| 2:20–3:00 | Guide, then architecture discussion | AI drafts require source checks; private documents are not shared with decks. Explain the budget gate and resumable batches. |

For a live AI demonstration, use your authorized private deployment and a small prepared document you own. Generation requires a funded API key and configured rates; it is not included in the anonymous demo. Never present a saved or manually written answer as a live generated result.

Restarting the server preserves the local database. Use a fresh browser profile for a separate fictional demo session. Avoid deleting local storage during a presentation.

## Interview talking points

- Why deterministic scheduling and review algorithms avoid recurring AI charges.
- Why shared decks are snapshots with independent review progress.
- How atomic reservations, concurrency limits and output bounds control AI admission.
- Why a citation validates evidence location but does not prove an answer's interpretation.
- What would change for a larger audience: normalized storage, pagination, a background job system, and narrower React components.

Suggested résumé description: Built and deployed a French-first React/TypeScript study companion with private document storage, resumable flashcard generation, spaced review, capacity-aware exam planning, and server-enforced AI allowances. Use only claims you can explain and demonstrate; no adoption or performance metrics are implied.
