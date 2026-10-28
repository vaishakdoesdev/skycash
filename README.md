# Sky Cash

Local-first decision support for evaluating whether workloads belong in a private data centre or an eligible public cloud region. Recommendations are intended to be deterministic and explainable; the application does not migrate workloads.

## Status

This repository contains the initial scaffold only. The supplied inventory has not been loaded or inspected, and the example schema is intentionally not an inventory contract. See `CURRENT_STATE.md` for verified status and `TASKS.md` for planned work.

## Requirements

- Python 3.10 or newer
- Node.js 18 or newer and npm

## Run the backend

From the repository root in PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r dev-requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

The scaffold exposes only `GET /health`. Run backend tests from `backend/` with `python -m pytest`.

## Run the frontend

In a second terminal from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Run the frontend checks from `frontend/` with `npm run typecheck` and `npm run build`.

## Local data handling

- Put confidential source inputs under `data/input/`; Git ignores their contents.
- Do not commit supplied inventory, secrets, or derived confidential data.
- `data/examples/workload.schema.json` is an unconstrained placeholder only. Confirm the real input schema locally before implementing ingestion.
- `data/synthetic/` is reserved for a future deterministic demo dataset; this scaffold does not contain one.
- No cloud credentials, paid APIs, database, or external AI service are needed or configured.

See `PROJECT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, and `AGENTS.md` for scope and implementation constraints.
