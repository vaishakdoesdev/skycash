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

- Frontend: React + TypeScript + Vite, plain CSS initially. Shared contracts in `frontend/src/types/schema.ts`.
- Backend: Python + FastAPI; Pydantic models in `backend/app/models/` for strict contract validation (`extra="forbid"`).
- Tests: pytest backend (`backend/tests/`); frontend typecheck (`tsc --noEmit`) and Vite production build.
- Data: local files (`data/input/` for confidential sources, `data/synthetic/` for demo mode); no database at this stage.
- Decision policy: explicit deterministic engine in `backend/app/engine/`, separate from API and UI.
- Documentation: `docs/DATA_DICTIONARY.md`, `docs/ALGORITHM.md`, `docs/SCENARIOS.md`, `ARCHITECTURE.md`, `DECISIONS.md`.

## Current facts

- Python 3.14.2, Node.js 24.16.0, and npm 11.13.0 are installed.
- Backend dependencies installed in `backend/.venv`; pytest runs cleanly (28 tests passed).
- Frontend dependencies installed in `frontend/node_modules`; typecheck and build pass cleanly.
- Domain data models (9 core schemas + 4 scenario schemas) implemented in Pydantic and TypeScript.
- Deterministic synthetic demo dataset is implemented and verified in `data/synthetic/`.
- Deterministic decision engine implemented in `backend/app/engine/` and verified.
- Scenario evaluation service implemented in `backend/app/engine/scenarios.py` and documented in `docs/SCENARIOS.md`.
- Next focus is implementing local data loading service and FastAPI endpoints in `backend/app/`.

## Working agreement for future agents

Read `AGENTS.md`, this file, `CURRENT_STATE.md`, and the relevant tasks before editing. Preserve existing work. Work offline with confidential data. Update the context and task status when implementation changes these facts.
