# Architecture

## Proposed structure

- `frontend/`: React + TypeScript + Vite client.
  - `frontend/src/types/schema.ts`: TypeScript contracts mirroring backend Pydantic models.
- `backend/app/`: FastAPI application.
  - `backend/app/models/`: Pydantic models (`schemas.py`) and enumerations (`enums.py`) defining core domain contracts and validation layer.
  - `backend/app/engine/`: deterministic placement rules, compliance gates, capacity checks, and cost models.
    - `compliance.py`: non-negotiable residency, sensitivity, and certification evaluation.
    - `cost.py`: fully burdened private DC (with PUE) and public cloud cost formulas.
    - `capacity.py`: usable private DC headroom evaluation.
    - `dependencies.py`: union-find co-location clustering.
    - `evaluator.py`: deterministic decision pipeline and tie-breaking orchestrator.
- `backend/tests/`: backend test suite (`test_health.py`, `test_schemas.py`, `test_engine.py`).
- `data/input/`: local-only confidential source inputs; ignored by Git.
- `data/examples/`: safe schema references and handling notes.
- `data/synthetic/`: deterministic, clearly labelled synthetic demonstration datasets.
- `docs/DATA_DICTIONARY.md`: comprehensive domain data dictionary, unit specifications, and consistency documentation.
- `docs/ALGORITHM.md`: formal algorithm documentation, cost formulas, tie-breaking order, and heuristic limitations.

## Data flow

1. A user selects locally available source data (under `data/input/`) or the deterministic synthetic demo mode (under `data/synthetic/`).
2. The backend validates input against formal Pydantic data models (`backend/app/models/`). Any extra or malformed inputs are rejected.
3. The deterministic engine applies residency, sensitivity, and mandatory co-location rules to determine eligible candidate placements before performing cost, capacity, and performance-related comparisons.
4. The engine returns structured `PlacementRecommendation`, `ComplianceViolation`, `CostCapacityScenario`, and `ReviewAlert` objects with factors, assumptions, and plain-language audit explanations.
5. The frontend displays results using mirrored TypeScript contracts (`frontend/src/types/schema.ts`). No step writes to infrastructure or initiates a migration.

All processing runs locally. Confidential inventory is never transmitted to an external service.

## Decision boundaries

- **Engine Layer**: Owns eligibility checking, constraint evaluation, placement comparisons, cost formulas, and explainability audit trails.
- **API Layer**: Validates input contracts, handles local file loading, and transports data; contains no business policy.
- **Frontend Layer**: Renders engine results, alerts, and comparison scenarios; does not re-implement policy or placement logic.
- **Hard vs. Soft Constraints**: Hard compliance constraints (data residency boundaries, sensitivity ceilings, mandatory co-location groups) cannot be overridden by lower cost or soft optimization preferences.
- **Auditing**: Recommendations accompany explicit assumptions, calculation units (INR, GiB, vCPU), binding constraints, and rejected alternatives.

## Current State

- Data models, contracts, and synthetic demo datasets verified.
- Deterministic decision engine implemented and verified with 20 backend tests passing.
- Frontend TypeScript typecheck and production build pass cleanly.
