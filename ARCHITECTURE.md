# Architecture

## Proposed structure

- `frontend/`: small React + TypeScript + Vite client.
- `backend/app/`: FastAPI application and future request/response models.
- `backend/app/engine/`: future deterministic placement rules and calculations; independent of HTTP and UI code.
- `backend/tests/`: backend checks, including engine tests as it is added.
- `data/input/`: local-only supplied inventory and other confidential source inputs; ignored by Git.
- `data/examples/`: schema and handling notes only, not the supplied inventory.
- `data/synthetic/`: reserved for deterministic synthetic demo data; no dataset is fabricated in this scaffold.

## Data flow

1. A user selects locally available source data or the future synthetic demo mode.
2. The backend validates input against a schema confirmed from the actual source. The current schema file is deliberately unconstrained and is not that confirmed schema.
3. The engine applies residency, sensitivity, and dependency/co-location rules to determine eligible placements before calculating cost, capacity, and performance-related comparisons.
4. The engine returns the current-state comparison, recommendation, factors, assumptions, and review alerts as explainable data.
5. The frontend presents the result for human review. No step writes to infrastructure or initiates a migration.

All steps are intended to run locally. No inventory is uploaded to an AI service, cloud service, or other external endpoint.

## Decision boundaries

- The engine owns eligibility, calculations, placement comparisons, and explanations.
- The API validates and transports data; it does not contain placement policy.
- The UI displays engine results and user-selected scenarios; it does not reimplement policy.
- Hard compliance constraints cannot be overridden by lower cost or other scores.
- Assumptions, units, and rule versions must accompany results so a reviewer can challenge them.

## Current scaffold

Only the project shell, documentation, a minimal API health endpoint, a frontend placeholder, and an unconstrained example-schema placeholder exist. There is no inventory parser, recommendation engine, scenario calculator, chart, cloud integration, migration capability, or real synthetic dataset yet.
