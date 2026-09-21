# Security and deployment boundaries

Do not include API keys, private documents, student records, database exports or screenshots of real accounts in issues, pull requests or demo assets. Use GitHub's private vulnerability reporting if enabled; otherwise contact the repository owner privately.

## Authentication trust boundary

Production relies on the Sites authentication dispatcher to establish identity and strip untrusted identity headers. **Do not expose the Worker directly to the public internet with the current header-based adapter.** Another host needs a verified session/JWT adapter and equivalent header filtering before launch. Local identity-header integration tests must bind only to loopback.

## Controls

- Member/owner checks and private file ownership are enforced server-side.
- Deck sharing copies selected cards without original files or conversations.
- API keys remain server-side; source checkouts default to AI disabled.
- Model prices must match the configured model before paid calls can be admitted.
- Allowance admission counts pending reservations, checks concurrent requests, and bounds output. Provider alerts are not guaranteed spending caps.
- SQL parameters are bound; state updates use revision checks; CSV export escapes formula-like cells.

## Operational responsibilities

Review provider invoices and reconcile uncertain reservations before releasing them. Apply dependency security updates after testing. Define retention and backup policies before expanding beyond the pilot. Public demo sessions are fictional and separate; their cookies are not a cross-device account system.
