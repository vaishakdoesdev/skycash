# Project Context

## Identity

- Name: Sky Cash
- Challenge: CC-03, “Which workload belongs where?”
- Timebox: 24-hour beginner hackathon
- Product: local-first hybrid workload placement decision support for a Karnataka private data centre and approved public cloud regions.

## Non-negotiable constraints

- Do not upload supplied inventory or operational data to third parties.
- Never recommend a placement that violates confirmed data-residency or sensitivity rules.
- Keep workloads co-located when the confirmed dependency model requires it.
- Do not execute migrations or connect to cloud accounts.
- State cost, capacity, and performance assumptions.
- Keep recommendations deterministic, explainable, and reviewable in under two minutes.
- Do not invent inventory columns, units, or policy details.

## Technical direction

- Frontend: React + TypeScript + Vite, plain CSS initially.
- Backend: Python + FastAPI; Pydantic for confirmed contracts.
- Tests: pytest backend; frontend typecheck and production build.
- Data: local files; no database at this stage.
- Decision policy: explicit deterministic engine, separate from API and UI.
- See `ARCHITECTURE.md` and `DECISIONS.md` for rationale and flow.

## Current facts

- The repository was initialized with Git and had no project files before scaffolding.
- The supplied inventory is not present in the workspace and has not been inspected or loaded.
- The actual input schema and assumptions remain unconfirmed.
- Synthetic fallback data is planned but has not been fabricated or implemented.
- Python 3.14.2, Node.js 24.16.0, and npm 11.13.0 are installed.
- Backend dependencies are installed in `backend/.venv`; pytest runs cleanly (1 passed).
- Frontend dependencies are installed in `frontend/node_modules`; typecheck and build pass cleanly.
- Current implementation status, validation outcomes, and setup blockers are recorded in `CURRENT_STATE.md`.

## Working agreement for future agents

Read `AGENTS.md`, this file, `CURRENT_STATE.md`, and the relevant tasks before editing. Preserve existing work. Work offline with confidential data. Update the context and task status when implementation changes these facts.
