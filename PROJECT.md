# Sky Cash

## Product

Sky Cash is a local-first, hybrid workload placement decision-support application for an organisation operating a small private data centre in Karnataka alongside approved public cloud regions.

For each workload, the planned application will recommend an eligible placement, explain its cost, capacity, performance-related, dependency, data-classification, and residency factors, and compare the recommendation with the current placement. It will help an infrastructure lead identify review-worthy placement changes as usage varies.

## Users and boundaries

- Primary user: an infrastructure lead evaluating workload placement.
- The application advises; it does not migrate workloads or change infrastructure.
- It is not a cloud-provider comparison product or a full CMDB.
- Supplied inventory and operational data stay local and must not be sent to external services.
- Residency and sensitivity rules are hard eligibility constraints, not score trade-offs.
- Recommendations must be deterministic, auditable, explainable, and challengeable in under two minutes.

## MVP scope

- Current versus recommended projected cost and capacity overview.
- Searchable workload inventory with placement, cost estimate, compliance, and explanation.
- Workload detail with factors, constraints, and assumptions.
- Comparison of private data centre and eligible public cloud placements.
- Dependency/co-location grouping and utilisation history.
- Review alerts when preferred placement changes over time.
- Compliance validation that excludes ineligible placements.
- Assumptions and methodology documentation.
- Deterministic synthetic-data demonstration mode.

## Input data

The supplied inventory has not been inspected or loaded. Its actual fields, formats, units, and semantics are unknown. Do not treat the placeholder under `data/examples/` as an inventory contract. Review the source locally and document the confirmed schema before implementing ingestion. Keep source and derived confidential data out of version control.

## Success criteria

- Invalid placements are never recommended.
- Dependency groups follow their documented co-location requirements.
- Costs and capacity estimates state their assumptions and units.
- Changes over time are reviewable and traceable to inputs and rules.
- The demo works without paid APIs, authentication services, cloud credentials, or external AI inference.
