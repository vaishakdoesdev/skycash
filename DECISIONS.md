# Architecture Decisions

## 1. Local-first processing

**Decision:** Inventory, scenarios, and recommendations are processed locally. No external AI inference, cloud account connection, or inventory upload is part of the MVP.

**Reason:** The supplied data is confidential and the product must work without paid or external services.

## 2. Separate deterministic decision engine

**Decision:** Keep future eligibility and placement calculations in `backend/app/engine/`, independent of FastAPI and React. Use explicit rules and calculations, not an LLM.

**Reason:** Recommendations must be reproducible, auditable, and explainable. Residency and sensitivity are hard constraints; dependency co-location follows the confirmed dependency model.

## 3. React, TypeScript, and Vite frontend

**Decision:** Use React, TypeScript, and Vite for the browser client. Start with plain CSS; do not add Tailwind until there is a concrete need and a reliable setup.

**Reason:** This is the requested default stack with a small setup and clear beginner-facing source.

## 4. FastAPI backend

**Decision:** Use Python and FastAPI, with Pydantic models when actual input/output contracts are established. Do not add pandas until confirmed data formats or calculations justify it.

**Reason:** FastAPI supports a small local API; avoiding premature data and model dependencies keeps the scaffold understandable.

## 5. No database at scaffold stage

**Decision:** Start with local files and no database.

**Reason:** The MVP can use local JSON/CSV inputs; persistence needs have not been established.

## 6. Do not guess the inventory schema

**Decision:** The example schema is an unconstrained placeholder, not a proposed inventory contract. The source inventory has not been loaded or inspected.

**Reason:** Input columns, units, and semantics are undocumented here. Guessing them would create false compatibility and could mis-handle compliance.

## 7. No migration capability

**Decision:** The app presents recommendations only. It will not execute or orchestrate migrations or infrastructure changes.

**Reason:** Explicit product boundary.

## 8. Minimal tests and dependencies

**Decision:** Use pytest for backend tests and TypeScript typecheck/build commands for the frontend. Add no frontend test framework, charting library, database, or pandas at scaffold time.

**Reason:** There is no implemented UI or placement logic to justify those dependencies yet; the selected checks cover the current shell.
