# Current State

## Implementation and Verification Result

- **Repository**: Git initialized, branch `main`.
- **Data Models & Contracts**:
  - Backend: Pydantic models in `backend/app/models/` (`schemas.py`, `enums.py`) defining formal contracts: `Workload`, `DependencyRelationship` & `DependencyGraph`, `PrivateDCAssumptions`, `PublicCloudRegion`, `UtilisationHistory`, `PlacementRecommendation`, `CostCapacityScenario`, `ComplianceViolation`, `ReviewAlert`, `OnPremiseResourceUtilization`, `ScenarioPlacementBreakdown`, `ScenarioSummary`, and `ScenarioEvaluationReport`.
  - Frontend: TypeScript contracts in `frontend/src/types/schema.ts` mirroring backend schemas with strict types.
  - Data Dictionary & Specs: `docs/DATA_DICTIONARY.md`, `docs/ALGORITHM.md`, `docs/SCENARIOS.md`.
- **Deterministic Placement Decision Engine**:
  - Located under `backend/app/engine/`:
    - `compliance.py`: Hard non-negotiable gates (residency boundaries, sensitivity limits, mandatory certifications, approval status).
    - `cost.py`: Fully burdened monthly cost calculation for Private DC (PUE multiplier) and Public Cloud (compute, RAM, SSD storage, egress).
    - `capacity.py`: Usable DC headroom checks for CPU, RAM, and persistent storage.
    - `dependencies.py`: Union-find mandatory co-location clustering and latency advisory checks.
    - `evaluator.py`: Deterministic decision pipeline with conflict checking, co-location preservation, explainability logging, and tie-breaking.
- **Scenario Evaluation Service**:
  - Located under `backend/app/engine/scenarios.py`:
    - Evaluates estate-wide placements across 4 scenarios: Current Baseline, Recommended Feasible, Private-DC-First, and Cloud-Prioritized.
    - Calculates absolute and percentage cost differences with formal sign convention: `negative = savings`, `positive = cost increase`.
    - Computes on-premise utilization across CPU, RAM, and Persistent Storage without double counting.
    - Calculates exact headroom and detects capacity violations.
    - Evaluates mandatory co-location group preservation count and fraction.
    - Enforces zero compliance violations for recommended sets.
    - Flags incomplete operational assumptions (e.g. unconfirmed network egress).
- **Synthetic Demonstration Suite**:
  - Located under `data/synthetic/` with mock enterprise data: `workloads.json`, `dependencies.json`, `datacenter_assumptions.json`, `cloud_regions.json`, and `utilisation_history.json`.
- **Frontend & Backend Toolchains**:
  - Frontend React + TypeScript + Vite app builds cleanly with `tsc` and `vite build`.
  - Backend FastAPI app in `.venv` passes complete test suite.

## Verification & Test Results

- Backend tests: `cd backend; .venv\Scripts\python -m pytest -v` passes: **28 passed, 1 harmless warning** in 0.51s.
  - 1 health test (`test_health.py`).
  - 11 schema & synthetic data validation tests (`test_schemas.py`).
  - 12 decision engine tests covering all required edge cases A-G (`test_engine.py`).
  - 4 scenario evaluation tests covering hand-calculated savings, compliance premium, headroom accounting, and dependency preservation (`test_scenarios.py`).
- Frontend checks: `cd frontend; npm run typecheck && npm run build` passes with zero errors.

## Next Step

- Implement local data loading service and FastAPI router endpoints in `backend/app/` (`/api/workloads`, `/api/recommendations`, `/api/scenarios`, `/api/alerts`).
- Connect frontend to API and build workload inventory, detail view, scenario comparison, and review alerts.
