# Tasks

## Done

- [x] Create the local-first project scaffold and document initial architecture choices.
- [x] Add minimal frontend and backend run/test entry points.
- [x] Add local-only data locations and an explicitly unconfirmed schema placeholder.
- [x] Validate scaffold JSON and Git ignore behavior; record environment check results.
- [x] Install documented dependencies locally (backend `.venv` & frontend `node_modules`), run backend test (`pytest`) and frontend checks (`tsc`, `vite build`).
- [x] Implement initial data model and validation layer (Pydantic in `backend/app/models/`, TypeScript contracts in `frontend/src/types/schema.ts`).
- [x] Create clearly labelled deterministic synthetic demo datasets in `data/synthetic/` (workloads, dependencies graph, DC assumptions, cloud regions, utilization history).
- [x] Author `docs/DATA_DICTIONARY.md` documenting all 9 domain schemas, units, explicit unknown representation, and consistency strategy.
- [x] Add schema validation and synthetic data validation tests (`backend/tests/test_schemas.py`, 12 tests total passing).
- [x] Implement deterministic placement decision engine in `backend/app/engine/` (compliance, cost, capacity, dependencies, evaluator).
- [x] Author `docs/ALGORITHM.md` explaining cost formulas, eligibility rules, co-location clustering, tie-breaking, and heuristic limitations.
- [x] Complete Prompt 2 Verification: Add and pass all 24 unit tests in `backend/tests/test_engine.py` covering Cases A through G, explainability, and determinism.
- [x] Implement Scenario Evaluation Service in `backend/app/engine/scenarios.py` (comparing current, recommended, DC-first, and cloud-prioritized scenarios).
- [x] Author `docs/SCENARIOS.md` documenting metric definitions, cost formulas, sign conventions, headroom accounting, and dependency preservation.
- [x] Add unit tests in `backend/tests/test_scenarios.py` with hand-calculated datasets (savings case, compliance-increase case, utilization accounting, dependency preservation; 28 tests total passing).
- [x] Implement local data loading service (`backend/app/services/data_loader.py`), alert generator (`backend/app/engine/alerts.py`), and FastAPI routes (`backend/app/api/`) with CORS and full test coverage (`backend/tests/test_api.py`; 47 tests passing total).

## Next

- [ ] Connect frontend to API and build workload inventory, detail view, scenario comparison, and review alerts.
- [ ] Add compliance summary and methodology explanation views in frontend.
- [ ] Inspect any supplied inventory locally if provided; map/document actual fields against the confirmed schema without uploading it.

## Deferred / out of scope

- Cloud account connections, infrastructure changes, and migration execution.
- Third-party AI inference or external inventory processing.
- Cloud-provider comparison and full CMDB features.
- Database, authentication service, and deployment infrastructure unless a justified need emerges.
