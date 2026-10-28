# Tasks

## Done

- [x] Create the local-first project scaffold and document initial architecture choices.
- [x] Add minimal frontend and backend run/test entry points.
- [x] Add local-only data locations and an explicitly unconfirmed schema placeholder.
- [x] Validate scaffold JSON and Git ignore behavior; record environment check results.
- [x] Install documented dependencies locally (backend `.venv` & frontend `node_modules`), run backend test (`pytest`) and frontend checks (`tsc`, `vite build`).

## Next

- [ ] Inspect the supplied inventory locally; document its actual fields, formats, units, and data classifications without uploading it.
- [ ] Agree on normalized input and output models based only on confirmed source data and official rules.
- [ ] Record cost, capacity, performance, residency, sensitivity, and dependency assumptions with an infrastructure lead.
- [ ] Implement and test deterministic eligibility rules, including residency/sensitivity blocking and dependency co-location.
- [ ] Implement auditable cost/capacity comparisons and current-versus-recommended explanations.
- [ ] Add deterministic synthetic demo data and verify it against the confirmed model.
- [ ] Add local data loading and API endpoints with input validation.
- [ ] Build the workload inventory, detail, scenario, dependency, history, and review-alert views.
- [ ] Add compliance and methodology views; verify that no migration action exists.

## Deferred / out of scope

- Cloud account connections, infrastructure changes, and migration execution.
- Third-party AI inference or external inventory processing.
- Cloud-provider comparison and full CMDB features.
- Database, authentication service, and deployment infrastructure unless a justified need emerges.
