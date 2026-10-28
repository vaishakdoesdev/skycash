/**
 * Sky Cash - Shared Data Models and Contracts
 * Consistent with backend Pydantic schemas in `backend/app/models/`
 */

// ==============================================================================
// Enums
// ==============================================================================

export type DataSensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type DataResidencyRequirement =
  | 'KARNATAKA_DC_ONLY'
  | 'INDIA_ONLY'
  | 'ANY_APPROVED_REGION';

export type DependencyType = 'CO_LOCATE' | 'LOW_LATENCY' | 'LOOSE_COUPLING';

export type PlacementType = 'PRIVATE_DC' | 'PUBLIC_CLOUD';

export type ApprovalStatus =
  | 'APPROVED'
  | 'PROVISIONAL'
  | 'RESTRICTED'
  | 'UNAPPROVED';

export type BillingPeriod = 'HOURLY' | 'MONTHLY' | 'ANNUAL';

export type Currency = 'INR' | 'USD';

export type TimeGranularity = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type RecommendationStatus =
  | 'ELIGIBLE'
  | 'INELIGIBLE'
  | 'NO_CHANGE'
  | 'CHANGE_RECOMMENDED'
  | 'REVIEW_REQUIRED';

export type ViolationSeverity = 'HARD_VIOLATION' | 'POLICY_WARNING';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AlertTriggerType =
  | 'PLACEMENT_CHANGED_OVER_TIME'
  | 'CAPACITY_THRESHOLD_BREACHED'
  | 'COST_VARIANCE_SPIKE'
  | 'NEW_COMPLIANCE_RESTRICTION';

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

// ==============================================================================
// 1. Workload Contracts
// ==============================================================================

export interface WorkloadSoftPreferences {
  preferred_provider: string | null;
  target_monthly_budget: number | null;
  max_acceptable_wan_latency_ms: number | null;
}

export interface Workload {
  id: string;
  name: string;
  environment: string;
  current_placement: string;
  data_sensitivity: DataSensitivity;
  residency_requirement: DataResidencyRequirement;
  required_certifications: string[];
  allocated_cpu_cores: number;
  allocated_ram_gib: number;
  allocated_storage_gib: number;
  storage_tier: string;
  soft_preferences: WorkloadSoftPreferences | null;
  tags: Record<string, string>;
  notes: string | null;
}

// ==============================================================================
// 2. Dependency Relationship & Graph Contracts
// ==============================================================================

export interface DependencyRelationship {
  id: string;
  source_workload_id: string;
  target_workload_id: string;
  relationship_type: DependencyType;
  is_mandatory: boolean;
  max_tolerable_latency_ms: number | null;
  data_exchange_gb_per_month: number | null;
  notes: string | null;
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyRelationship[];
  co_location_groups: Record<string, string[]>;
}

// ==============================================================================
// 3. Private Data Centre Assumptions Contracts
// ==============================================================================

export interface PrivateDCAssumptions {
  dc_id: string;
  name: string;
  location_country: string;
  location_state: string;
  total_cpu_cores: number;
  usable_cpu_cores: number;
  total_ram_gib: number;
  usable_ram_gib: number;
  total_storage_gib: number;
  usable_storage_gib: number;
  currency: Currency;
  billing_period: BillingPeriod;
  amortized_cost_per_cpu_core_month: number;
  amortized_cost_per_ram_gib_month: number;
  amortized_cost_per_storage_gib_month: number;
  power_cooling_pue_overhead_pct: number;
  fixed_monthly_facility_cost: number;
  assumptions_notes: string;
}

// ==============================================================================
// 4. Public Cloud Region Contracts
// ==============================================================================

export interface PublicCloudRegion {
  region_id: string;
  provider: string;
  region_name: string;
  location_country: string;
  location_city: string;
  approval_status: ApprovalStatus;
  allowed_sensitivities: DataSensitivity[];
  supports_residency_in: string[];
  compliance_certifications: string[];
  currency: Currency;
  billing_period: BillingPeriod;
  compute_rate_per_vcpu_month: number;
  memory_rate_per_gib_month: number;
  storage_ssd_rate_per_gib_month: number;
  egress_rate_per_gib: number;
  eligibility_rules: string[];
}

// ==============================================================================
// 5. Utilisation History Contracts
// ==============================================================================

export interface UtilisationHistory {
  workload_id: string;
  timestamp: string; // ISO 8601 string
  duration_hours: number;
  granularity: TimeGranularity;
  cpu_utilization_pct: number;
  cpu_peak_pct: number | null;
  cpu_used_cores: number;
  ram_utilization_pct: number;
  ram_used_gib: number;
  storage_used_gib: number;
  network_egress_gib: number;
  is_synthetic: boolean;
}

// ==============================================================================
// 6. Placement Recommendation Contracts
// ==============================================================================

export interface PlacementRecommendation {
  workload_id: string;
  current_placement: string;
  recommended_placement: string | null;
  status: RecommendationStatus;
  current_monthly_cost: number;
  recommended_monthly_cost: number | null;
  projected_monthly_savings: number | null;
  currency: Currency;
  billing_period: BillingPeriod;
  capacity_allocated_cpu: number;
  capacity_allocated_ram_gib: number;
  capacity_allocated_storage_gib: number;
  co_location_group_id: string | null;
  co_located_workload_ids: string[];
  hard_compliance_passed: boolean;
  factors: string[];
  binding_constraints: string[];
  assumptions: string[];
  rejected_alternatives: Record<string, string>;
  audit_explanation: string;
  rule_engine_version: string;
}

// ==============================================================================
// 7. Cost and Capacity Scenario Contracts
// ==============================================================================

export interface CostCapacityScenario {
  scenario_id: string;
  name: string;
  description: string;
  timeframe_months: number;
  cpu_growth_rate_pct: number;
  ram_growth_rate_pct: number;
  storage_growth_rate_pct: number;
  cloud_cost_adjustment_pct: number;
  private_dc_cost_adjustment_pct: number;
  projected_total_dc_cpu_used: number;
  projected_total_dc_ram_gib_used: number;
  projected_total_dc_storage_gib_used: number;
  projected_total_monthly_cost: number;
  currency: Currency;
}

// ==============================================================================
// 8. Compliance Violation Contracts
// ==============================================================================

export interface ComplianceViolation {
  id: string;
  workload_id: string;
  placement_id: string;
  rule_name: string;
  severity: ViolationSeverity;
  description: string;
  conflicting_attribute: string;
  required_value: string;
  actual_value: string;
}

// ==============================================================================
// 9. Review Alert Contracts
// ==============================================================================

export interface ReviewAlert {
  alert_id: string;
  workload_id: string;
  created_at: string; // ISO 8601 string
  trigger_type: AlertTriggerType;
  severity: AlertSeverity;
  title: string;
  summary: string;
  previous_placement: string | null;
  new_placement: string | null;
  cost_delta: number | null;
  currency: Currency;
  status: AlertStatus;
  audit_rationale: string;
}

// ==============================================================================
// 10. Scenario Evaluation Contracts
// ==============================================================================

export interface OnPremiseResourceUtilization {
  dimension: string;
  unit: string;
  allocated: number;
  usable_capacity: number;
  total_capacity: number;
  utilization_pct: number;
  headroom: number;
  is_violated: boolean;
  violation_amount: number;
}

export interface ScenarioPlacementBreakdown {
  workload_id: string;
  workload_name: string;
  current_placement: string;
  assigned_placement: string | null;
  monthly_cost: number;
  cost_delta_from_current: number;
  cost_delta_pct_from_current: number | null;
  is_compliant: boolean;
  compliance_violations: string[];
  assumptions: string[];
}

export interface ScenarioSummary {
  scenario_id: string;
  scenario_name: string;
  description: string;
  projected_monthly_cost: number;
  is_cost_estimate: boolean;
  cost_estimate_disclaimer: string;
  cost_difference_absolute: number;
  cost_difference_pct: number;
  sign_convention: string;
  currency: Currency;
  billing_period: BillingPeriod;
  on_premise_utilization: OnPremiseResourceUtilization[];
  has_capacity_violations: boolean;
  capacity_violations_count: number;
  mandatory_dependency_groups_total: number;
  mandatory_dependency_groups_preserved: number;
  mandatory_dependency_groups_fraction: number;
  compliance_violations_count: number;
  is_feasible: boolean;
  per_workload_breakdown: ScenarioPlacementBreakdown[];
  unconfirmed_metrics: string[];
}

export interface ScenarioEvaluationReport {
  generated_at: string; // ISO 8601 string
  currency: Currency;
  billing_period: BillingPeriod;
  current_scenario: ScenarioSummary;
  recommended_scenario: ScenarioSummary;
  alternative_scenarios: ScenarioSummary[];
  audit_notes: string[];
}
