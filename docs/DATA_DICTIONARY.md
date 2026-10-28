# Sky Cash Data Dictionary

This document defines the formal data models, schemas, units, and boundary constraints for **Sky Cash** (CC-03: Which workload belongs where?).

---

## 1. Architectural Principles and Consistency Strategy

### 1.1 Backend and Frontend Contract Alignment
- **Backend Single Source of Truth**: Pydantic models in [`backend/app/models/`](file:///D:/skycash/backend/app/models/) define runtime validation, extra-field rejection (`extra="forbid"`), and strict typing.
- **Frontend Contract Mirror**: TypeScript types in [`frontend/src/types/schema.ts`](file:///D:/skycash/frontend/src/types/schema.ts) strictly mirror the Pydantic schemas.
- **Consistency Enforcement**:
  - Field names use snake_case across both Python and TypeScript to avoid translation errors.
  - Optional fields are explicitly typed as `T | null` in TypeScript and `Optional[T] = None` in Pydantic.
  - Python tests validate synthetic JSON files against Pydantic models, while `npm run typecheck` validates the TypeScript contracts.

### 1.2 Explicit Handling of Unknowns and Units
- **No Implicit Assumptions**: If a value is unknown (e.g. latency, transfer volume, provider preference), it is explicitly set to `null` / `None`.
- **Explicit Units**:
  - Currency: Standardized to ISO 4217 code (`"INR"` or `"USD"`).
  - Billing Interval: Standardized to `"MONTHLY"` (or `"HOURLY"` / `"ANNUAL"`).
  - Compute: Virtual CPU cores (`vCPU`).
  - Memory: Binary gigabytes (`GiB`).
  - Storage: Binary gigabytes (`GiB`).
  - Network Latency: Milliseconds (`ms`).
  - Network Bandwidth / Egress: Binary gigabytes (`GiB`).

### 1.3 Separation of Hard Compliance vs. Soft Optimisation
- **Hard Compliance Rules (Non-Negotiable)**: Evaluated first. Disqualifies candidate placements outright if violated.
  - Residency boundary (`KARNATAKA_DC_ONLY`, `INDIA_ONLY`).
  - Sensitivity ceilings (e.g. `RESTRICTED` data cannot leave the private DC).
  - Mandatory co-location (`is_mandatory=True` in dependency relationships).
  - Required compliance certifications (e.g. `RBI_LOCALIZATION`, `MEITY_EMPANELLED`).
- **Soft Optimisation Preferences**: Evaluated only after hard compliance checks pass:
  - Cost minimization / target monthly budgets.
  - Latency preference targets.
  - Preferred cloud provider.

---

## 2. Schema Specifications

### 2.1 Workload (`Workload`)
Represents an individual computational workload or application service subject to placement decision support.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Unique immutable identifier (e.g. `"wl-core-banking-db"`). |
| `name` | `string` | Yes | Human-readable service name. |
| `environment` | `string` | Yes | Operating lifecycle stage (e.g. `"production"`, `"staging"`, `"development"`). |
| `current_placement` | `string` | Yes | Current placement identifier (e.g. `"karnataka-dc-1"`). |
| `data_sensitivity` | `DataSensitivity` | Yes | Classification level: `"PUBLIC"`, `"INTERNAL"`, `"CONFIDENTIAL"`, `"RESTRICTED"`. |
| `residency_requirement` | `DataResidencyRequirement` | Yes | Boundary requirement: `"KARNATAKA_DC_ONLY"`, `"INDIA_ONLY"`, `"ANY_APPROVED_REGION"`. |
| `required_certifications` | `string[]` | Yes | Mandatory compliance certifications (e.g. `["RBI_LOCALIZATION", "ISO27001"]`). Empty array if none. |
| `allocated_cpu_cores` | `float` | Yes | Compute allocation in cores (`gt=0.0`). |
| `allocated_ram_gib` | `float` | Yes | Memory allocation in GiB (`gt=0.0`). |
| `allocated_storage_gib` | `float` | Yes | Persistent storage in GiB (`gt=0.0`). |
| `storage_tier` | `string` | Yes | Storage performance grade (`"SSD"`, `"NVME"`, `"HDD"`). |
| `soft_preferences` | `WorkloadSoftPreferences \| null` | No | Optimization preferences (budget, provider preference, latency threshold). Explicitly `null` if none. |
| `tags` | `Record<string, string>` | Yes | Operational metadata tags. |
| `notes` | `string \| null` | No | Operational background notes. Explicitly `null` if empty. |

---

### 2.2 Dependency Relationship (`DependencyRelationship` & `DependencyGraph`)
Represents directed network dependencies and co-location constraints between workloads.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Unique dependency identifier (e.g. `"dep-api-to-db"`). |
| `source_workload_id` | `string` | Yes | Workload initiating calls / having dependency. |
| `target_workload_id` | `string` | Yes | Workload being depended upon. |
| `relationship_type` | `DependencyType` | Yes | `"CO_LOCATE"`, `"LOW_LATENCY"`, or `"LOOSE_COUPLING"`. |
| `is_mandatory` | `boolean` | Yes | If `true` and type is `CO_LOCATE`, workloads must reside in the exact same placement. |
| `max_tolerable_latency_ms` | `float \| null` | No | Network latency threshold in ms. Explicitly `null` if unmeasured. |
| `data_exchange_gb_per_month` | `float \| null` | No | Estimated data transfer volume in GiB/month. Explicitly `null` if unknown. |
| `notes` | `string \| null` | No | Engineering rationale for relationship. |

`DependencyGraph` aggregates:
- `nodes`: `string[]` list of workload IDs.
- `edges`: `DependencyRelationship[]` list of relationships.
- `co_location_groups`: `Record<string, string[]>` mapping co-location group IDs to member workload IDs.

---

### 2.3 Private Data Centre Assumptions (`PrivateDCAssumptions`)
Establishes the physical hardware bounds and fully amortized cost baseline for the on-premise Karnataka facility.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `dc_id` | `string` | Yes | Facility identifier (e.g. `"karnataka-dc-1"`). |
| `name` | `string` | Yes | Display name. |
| `location_country` | `string` | Yes | Sovereign country code (`"IN"`). |
| `location_state` | `string` | Yes | State boundary (`"Karnataka"`). |
| `total_cpu_cores` | `float` | Yes | Installed hardware cores. |
| `usable_cpu_cores` | `float` | Yes | Usable cores excluding hypervisor overhead. |
| `total_ram_gib` | `float` | Yes | Total installed physical RAM in GiB. |
| `usable_ram_gib` | `float` | Yes | Usable RAM in GiB after hypervisor reserve. |
| `total_storage_gib` | `float` | Yes | Total installed SAN/NAS raw disk in GiB. |
| `usable_storage_gib` | `float` | Yes | Usable storage in GiB after RAID/parity reserve. |
| `currency` | `Currency` | Yes | Currency code (`"INR"`). |
| `billing_period` | `BillingPeriod` | Yes | Duration basis (`"MONTHLY"`). |
| `amortized_cost_per_cpu_core_month` | `float` | Yes | Fully amortized cost per core-month in INR. |
| `amortized_cost_per_ram_gib_month` | `float` | Yes | Fully amortized cost per GiB RAM-month in INR. |
| `amortized_cost_per_storage_gib_month` | `float` | Yes | Fully amortized cost per GiB storage-month in INR. |
| `power_cooling_pue_overhead_pct` | `float` | Yes | PUE overhead percentage (e.g. `18.5`%). |
| `fixed_monthly_facility_cost` | `float` | Yes | Facility baseline overhead (racks, power contracts, links) in INR. |
| `assumptions_notes` | `string` | Yes | Transparent justification of depreciation lifecycle and rate basis. |

---

### 2.4 Public Cloud Region (`PublicCloudRegion`)
Defines the parameters, rate card, and eligibility constraints for an approved public cloud region.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `region_id` | `string` | Yes | Cloud region identifier (e.g. `"aws-ap-south-1"`). |
| `provider` | `string` | Yes | Provider name (`"AWS"`, `"Azure"`, `"GCP"`). |
| `region_name` | `string` | Yes | Official region designation (e.g. `"Asia Pacific (Mumbai)"`). |
| `location_country` | `string` | Yes | ISO country code (`"IN"`). |
| `location_city` | `string` | Yes | Metro city locality (e.g. `"Mumbai"`). |
| `approval_status` | `ApprovalStatus` | Yes | `"APPROVED"`, `"PROVISIONAL"`, `"RESTRICTED"`, `"UNAPPROVED"`. |
| `allowed_sensitivities` | `DataSensitivity[]` | Yes | Permitted data classification levels. |
| `supports_residency_in` | `string[]` | Yes | Sovereign boundary regimes satisfied (e.g. `["IN"]`). |
| `compliance_certifications` | `string[]` | Yes | Audited compliance badges (e.g. `["RBI_LOCALIZATION", "MEITY_EMPANELLED"]`). |
| `currency` | `Currency` | Yes | Rate card currency (`"INR"`). |
| `billing_period` | `BillingPeriod` | Yes | Billing interval (`"MONTHLY"`). |
| `compute_rate_per_vcpu_month` | `float` | Yes | On-demand rate per vCPU-month in INR. |
| `memory_rate_per_gib_month` | `float` | Yes | On-demand rate per GiB RAM-month in INR. |
| `storage_ssd_rate_per_gib_month` | `float` | Yes | General Purpose SSD rate per GiB-month in INR. |
| `egress_rate_per_gib` | `float` | Yes | Outbound internet/WAN data transfer rate per GiB in INR. |
| `eligibility_rules` | `string[]` | Yes | Explicit human-readable rules governing region admissibility. |

---

### 2.5 Utilisation History (`UtilisationHistory`)
Captures observed resource consumption over time windows to evaluate whether provisioning matches actual demand.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `workload_id` | `string` | Yes | Target workload identifier. |
| `timestamp` | `string` (ISO 8601) | Yes | Start timestamp of telemetry window in UTC. |
| `duration_hours` | `float` | Yes | Window length (e.g. `720.0` for monthly). |
| `granularity` | `TimeGranularity` | Yes | `"HOURLY"`, `"DAILY"`, `"WEEKLY"`, `"MONTHLY"`. |
| `cpu_utilization_pct` | `float` | Yes | Mean CPU percentage (0.0 to 100.0). |
| `cpu_peak_pct` | `float \| null` | No | Peak CPU percentage observed. `null` if not recorded. |
| `cpu_used_cores` | `float` | Yes | Effective cores consumed. |
| `ram_utilization_pct` | `float` | Yes | Mean RAM percentage (0.0 to 100.0). |
| `ram_used_gib` | `float` | Yes | Effective memory consumed in GiB. |
| `storage_used_gib` | `float` | Yes | Actual disk space used in GiB. |
| `network_egress_gib` | `float` | Yes | Outbound network egress in GiB. |
| `is_synthetic` | `boolean` | Yes | Explicit flag indicating test/synthetic data. |

---

### 2.6 Placement Recommendation (`PlacementRecommendation`)
Represents the deterministic output of evaluating a workload against all eligible placements.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `workload_id` | `string` | Yes | Target workload identifier. |
| `current_placement` | `string` | Yes | Current location ID. |
| `recommended_placement` | `string` | Yes | Recommended target location ID. |
| `status` | `RecommendationStatus` | Yes | `"ELIGIBLE"`, `"INELIGIBLE"`, `"NO_CHANGE"`, `"CHANGE_RECOMMENDED"`. |
| `current_monthly_cost` | `float` | Yes | Monthly run cost in current location in INR. |
| `recommended_monthly_cost` | `float` | Yes | Monthly run cost in recommended location in INR. |
| `projected_monthly_savings` | `float` | Yes | Net variance (`current - recommended`) in INR. |
| `currency` | `Currency` | Yes | Accounting currency (`"INR"`). |
| `billing_period` | `BillingPeriod` | Yes | Billing interval (`"MONTHLY"`). |
| `capacity_allocated_cpu` | `float` | Yes | Compute core footprint. |
| `capacity_allocated_ram_gib` | `float` | Yes | Memory GiB footprint. |
| `capacity_allocated_storage_gib` | `float` | Yes | Storage GiB footprint. |
| `co_location_group_id` | `string \| null` | No | Co-location group ID if co-located. |
| `co_located_workload_ids` | `string[]` | Yes | IDs of companion workloads co-located in same placement. |
| `hard_compliance_passed` | `boolean` | Yes | `true` only if all residency and sensitivity rules pass. |
| `factors` | `string[]` | Yes | List of deterministic scoring factors. |
| `assumptions` | `string[]` | Yes | Operational assumptions applied. |
| `audit_explanation` | `string` | Yes | Plain language rationale challengeable in under two minutes. |
| `rule_engine_version` | `string` | Yes | Deterministic decision engine version string. |

---

### 2.7 Cost and Capacity Scenario (`CostCapacityScenario`)
Models growth projections and estate-level capacity planning.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `scenario_id` | `string` | Yes | Unique scenario identifier. |
| `name` | `string` | Yes | Scenario title. |
| `description` | `string` | Yes | Description of assumptions and growth drivers. |
| `timeframe_months` | `integer` | Yes | Horizon in months (e.g. `12`). |
| `cpu_growth_rate_pct` | `float` | Yes | Projected CPU demand growth percentage. |
| `ram_growth_rate_pct` | `float` | Yes | Projected RAM demand growth percentage. |
| `storage_growth_rate_pct` | `float` | Yes | Projected storage demand growth percentage. |
| `cloud_cost_adjustment_pct` | `float` | Yes | Cloud price index adjustment percentage. |
| `private_dc_cost_adjustment_pct` | `float` | Yes | Data centre cost adjustment percentage. |
| `projected_total_dc_cpu_used` | `float` | Yes | Forecasted total private DC cores utilized. |
| `projected_total_dc_ram_gib_used` | `float` | Yes | Forecasted total private DC RAM GiB utilized. |
| `projected_total_dc_storage_gib_used` | `float` | Yes | Forecasted total private DC storage GiB utilized. |
| `projected_total_monthly_cost` | `float` | Yes | Forecasted estate monthly expenditure in INR. |
| `currency` | `Currency` | Yes | Currency code (`"INR"`). |

---

### 2.8 Compliance Violation (`ComplianceViolation`)
Records an explicit breach detected during placement eligibility checks.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Unique violation identifier. |
| `workload_id` | `string` | Yes | Workload evaluated. |
| `placement_id` | `string` | Yes | Candidate or current placement evaluated. |
| `rule_name` | `string` | Yes | Policy rule identifier (e.g. `"DATA_RESIDENCY_KARNATAKA_DC_ONLY"`). |
| `severity` | `ViolationSeverity` | Yes | `"HARD_VIOLATION"` (disqualifies) or `"POLICY_WARNING"`. |
| `description` | `string` | Yes | Plain-language breach explanation. |
| `conflicting_attribute` | `string` | Yes | Attribute checked (e.g. `"location_state"`). |
| `required_value` | `string` | Yes | Mandatory value (e.g. `"Karnataka"`). |
| `actual_value` | `string` | Yes | Observed value in candidate placement (e.g. `"Maharashtra"`). |

---

### 2.9 Review Alert (`ReviewAlert`)
Notifies infrastructure leads when a workload's optimal placement changes over time or breaches thresholds.

| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `alert_id` | `string` | Yes | Unique alert identifier. |
| `workload_id` | `string` | Yes | Subject workload identifier. |
| `created_at` | `string` (ISO 8601) | Yes | Timestamp of alert generation in UTC. |
| `trigger_type` | `AlertTriggerType` | Yes | `"PLACEMENT_CHANGED_OVER_TIME"`, `"CAPACITY_THRESHOLD_BREACHED"`, `"COST_VARIANCE_SPIKE"`, `"NEW_COMPLIANCE_RESTRICTION"`. |
| `severity` | `AlertSeverity` | Yes | `"INFO"`, `"WARNING"`, `"CRITICAL"`. |
| `title` | `string` | Yes | Brief alert headline. |
| `summary` | `string` | Yes | Detailed operational explanation. |
| `previous_placement` | `string \| null` | No | Former placement ID. `null` if initial run. |
| `new_placement` | `string \| null` | No | Recommended new placement ID. `null` if unplaced. |
| `cost_delta` | `float \| null` | No | Cost difference in INR (`new - old`). `null` if not cost-driven. |
| `currency` | `Currency` | Yes | Currency code (`"INR"`). |
| `status` | `AlertStatus` | Yes | `"ACTIVE"`, `"ACKNOWLEDGED"`, `"RESOLVED"`. |
| `audit_rationale` | `string` | Yes | Decision engine audit trail explaining the trigger. |
