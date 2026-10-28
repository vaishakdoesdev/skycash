# Agent Guidance

- Read `PROJECT_CONTEXT.md`, `CURRENT_STATE.md`, `TASKS.md`, and the relevant architecture docs before making changes.
- Keep the recommendation engine deterministic, explicit, testable, and separate from the frontend and API.
- Treat inventory and operational inputs as confidential local data. Never send them to third-party services or AI tools.
- Do not connect to cloud accounts or execute migrations. This project provides decision support only.
- Enforce residency and sensitivity constraints before scoring eligible placements. Explain recommendations and assumptions in plain language.
- Do not infer the supplied inventory's columns. Review the local source and document its actual schema before implementing ingestion.
- Keep beginner-facing code small; add dependencies only for a clear need.
- Run the narrow relevant checks and update `TASKS.md`, `PROJECT_CONTEXT.md`, and `CURRENT_STATE.md` as project state changes.
