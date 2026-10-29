# Current State

## Implementation and Verification Result

- **Repository**: Git initialized, branch `main`.
- **Data Models & Contracts**:
  - Backend: Pydantic models in `backend/app/models/` (`schemas.py`, `enums.py`) defining formal contracts: `Workload`, `DependencyRelationship` & `DependencyGraph`, `PrivateDCAssumptions`, `PublicCloudRegion`, `UtilisationHistory`, `PlacementRecommendation`, `CostCapacityScenario`, `ComplianceViolation`, `ReviewAlert`, `OnPremiseResourceUtilization`, `ScenarioPlacementBreakdown`, `ScenarioSummary`, `ScenarioEvaluationReport`, and `PlacementFlowEvaluation`.
  - Frontend: TypeScript contracts in `frontend/src/types/schema.ts` mirroring backend schemas with strict types.
  - Data Dictionary & Specs: `docs/DATA_DICTIONARY.md`, `docs/ALGORITHM.md`, `docs/SCENARIOS.md`.
- **Deterministic Placement Decision Engine**:
  - Located under `backend/app/engine/`:
    - `compliance.py`: Hard non-negotiable gates (residency boundaries, sensitivity limits, mandatory certifications, approval status).
    - `cost.py`: Fully burdened monthly cost calculation for Private DC (PUE multiplier) and Public Cloud (compute, RAM, SSD storage, egress).
    - `capacity.py`: Usable DC headroom checks for CPU, RAM, and persistent storage.
    - `dependencies.py`: Union-find mandatory co-location clustering and latency advisory checks.
    - `evaluator.py`: Deterministic decision pipeline with conflict checking, co-location preservation, explainability logging, and tie-breaking.
    - `alerts.py`: Deterministic review alert generation for placement change, capacity breach, and review required triggers.
    - `placement_modes.py`: Strategy Mode Flow evaluating Cloud-Only (hired servers) vs. Hybrid (local + hired) placements, identifying DC underutilisation or capacity overload, and selecting lowest-cost feasible recommendations.
- **Authentication & Frontend Integration Layer**:
  - `backend/app/models/auth_schemas.py`: Schemas for `UserPublic`, `AuthConfig`, `AuthResponse`, `LoginRequest`, `RegisterRequest`, `GoogleAuthRequest`, `ForgotPasswordRequest`.
  - `backend/app/api/auth.py`: Fully local authentication subsystem matching `frontend/authDevPlugin.js`:
    - PBKDF2-SHA256 password hashing with 100,000 iterations.
    - In-memory bearer token & cookie-based session verification (`/api/auth/me`, `/api/auth/logout`).
    - Login brute-force protection (5 failed attempts trigger 15-minute lockout with HTTP 429).
    - Local user persistence in `data/auth_users.json` with pre-seeded demo accounts (`demo@butane.io`, `admin@skycash.io`).
    - Password reset request handler (`/api/auth/forgot-password`).
  - Added data endpoints consumed by `frontend/src/services/api.ts`:
    - `GET /api/datacenter`: Datacenter capacity bounds and cost assumptions.
    - `GET /api/regions`: Approved cloud regions and rate sheets.
    - `GET /api/dependencies`: Dependency graph and mandatory co-location groups.
    - `GET /api/health`: Health probe endpoint.
  - Endpoints returning raw JSON arrays by default (`/api/workloads`, `/api/recommendations`, `/api/utilisation`, `/api/alerts`) to support direct array operations (`.map`, `.length`) in frontend services, with optional `?envelope=true` parameter for wrapped schemas.
- **Scenario Evaluation Service**:
  - Located under `backend/app/engine/scenarios.py`:
    - Evaluates estate-wide placements across 4 scenarios: Current Baseline, Recommended Feasible, Private-DC-First, and Cloud-Prioritized.
    - Calculates absolute and percentage cost differences with formal sign convention: `negative = savings`, `positive = cost increase`.
    - Computes on-premise utilization across CPU, RAM, and Persistent Storage without double counting.
    - Calculates exact headroom and detects capacity violations.
    - Evaluates mandatory co-location group preservation count and fraction.
    - Enforces zero compliance violations for recommended sets.
    - Flags incomplete operational assumptions (e.g. unconfirmed network egress).
- **API & Data Loading Layer**:
  - `backend/app/services/data_loader.py`: Local filesystem loading with fallback from `data/input/` to `data/synthetic/` and caching.
  - `backend/app/api/response_models.py` & `backend/app/api/routes.py`: REST endpoints mounted in `backend/app/main.py` with CORS support for `localhost:5173`.
  - Endpoints:
    - `GET /health` & `GET /api/health`: Health check probes.
    - `GET /api/datacenter`: Datacenter assumptions.
    - `GET /api/regions`: Public cloud regions.
    - `GET /api/dependencies`: Workload dependencies.
    - `GET /api/workloads`: Workload inventory (array default, or envelope with `?envelope=true`).
    - `GET /api/workloads/{workload_id}`: Single workload + recommendation.
    - `GET /api/recommendations`: Complete placement recommendations (array default, or envelope with `?envelope=true`).
    - `GET /api/recommendations/{workload_id}`: Recommendation for a specific workload.
    - `GET /api/scenarios`: Full multi-scenario evaluation report.
    - `GET /api/scenarios/{scenario_id}`: Individual scenario summary.
    - `GET /api/flow/evaluation`: Workload placement strategy flow evaluation (`mode=CLOUD_ONLY|HYBRID`).
    - `GET /api/utilisation`: Utilisation history (array default, or envelope with `?envelope=true`).
    - `GET /api/alerts`: Review alerts (array default, or envelope with `?envelope=true`).
    - `GET /api/assumptions`: DC assumptions, cloud region configs, methodology, and limitations.
    - `GET /api/auth/*`: Auth config, session check, login, register, logout, google, and forgot-password.
- **Synthetic Demonstration Suite**:
  - Located under `data/synthetic/` with mock enterprise data: `workloads.json`, `dependencies.json`, `datacenter_assumptions.json`, `cloud_regions.json`, and `utilisation_history.json`.
- **Frontend & Backend Toolchains**:
  - Frontend React + TypeScript + Vite app builds cleanly with `npm --prefix frontend run build` (`tsc --noEmit && vite build`).
  - Strictly zero modifications made to `frontend/` files.
  - Backend FastAPI app in `.venv` passes complete test suite.

## Verification & Test Results

- Backend tests: `backend\.venv\Scripts\python -m pytest -v` passes: **65 passed, 1 harmless warning** in 1.05s.
  - 1 health test (`test_health.py`).
  - 11 schema & synthetic data validation tests (`test_schemas.py`).
  - 12 decision engine tests covering all required edge cases A-G (`test_engine.py`).
  - 4 scenario evaluation tests covering hand-calculated savings, compliance premium, headroom accounting, and dependency preservation (`test_scenarios.py`).
  - 30 API, auth, data loader, and architecture tests covering all route filters, details, errors, alerts, caching, flow evaluations, datacenter, regions, dependencies, and auth flow (`test_api.py`).
  - 7 strategy mode flow tests covering cloud-only compliance rejection, cloud-only all eligible, local-only capacity overload, hybrid lowest-cost feasible selection, all-infeasible rejection, co-location in cloud, and synthetic dataset evaluation (`test_placement_modes.py`).
- Frontend checks: `npm --prefix frontend run build` passes with zero errors.

## Next Steps

- All backend routes, schemas, and authentication flows fully aligned with the frontend.
- Connect strategy mode flow evaluation to the frontend when ready.
