// Sky Cash - Workload Placement Decision Support Types
// Strictly mirrors backend Pydantic models in backend/app/models/

export type DataSensitivity = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type DataResidencyRequirement =
  | 'KARNATAKA_DC_ONLY'
  | 'INDIA_ONLY'
  | 'ANY_APPROVED_REGION';

export type DependencyType = 'CO_LOCATE' | 'LOW_LATENCY' | 'LOOSE_COUPLING';

export type PlacementType = 'PRIVATE_DC' | 'PUBLIC_CLOUD';

export type ApprovalStatus = 'APPROVED' | 'PROVISIONAL' | 'RESTRICTED' | 'UNAPPROVED';

export type BillingPeriod = 'HOURLY' | 'MONTHLY' | 'ANNUAL';

export type Currency = 'INR' | 'USD';

export type TimeGranularity = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type RecommendationStatus =
  | 'ELIGIBLE'
  | 'INELIGIBLE'
  | 'NO_CHANGE'
  | 'CHANGE_RECOMMENDED';

export type ViolationSeverity = 'HARD_VIOLATION' | 'POLICY_WARNING';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AlertTriggerType =
  | 'PLACEMENT_CHANGED_OVER_TIME'
  | 'CAPACITY_THRESHOLD_BREACHED'
  | 'COST_VARIANCE_SPIKE'
  | 'NEW_COMPLIANCE_RESTRICTION';

export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface WorkloadSoftPreferences {
  preferred_provider?: string | null;
  target_monthly_budget?: number | null;
  max_acceptable_wan_latency_ms?: number | null;
}

export interface Workload {
  id: string;
  name: string;
  environment: 'production' | 'staging' | 'development' | string;
  current_placement: string;
  data_sensitivity: DataSensitivity;
  residency_requirement: DataResidencyRequirement;
  required_certifications: string[];
  allocated_cpu_cores: number;
  allocated_ram_gib: number;
  allocated_storage_gib: number;
  storage_tier?: string;
  soft_preferences?: WorkloadSoftPreferences | null;
  tags?: Record<string, string>;
  notes?: string | null;
}

export interface DependencyRelationship {
  id: string;
  source_workload_id: string;
  target_workload_id: string;
  relationship_type: DependencyType;
  is_mandatory: boolean;
  max_tolerable_latency_ms?: number | null;
  data_exchange_gb_per_month?: number | null;
  notes?: string | null;
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyRelationship[];
  co_location_groups: Record<string, string[]>;
}

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

export interface UtilisationHistory {
  workload_id: string;
  timestamp: string;
  duration_hours: number;
  granularity: TimeGranularity;
  cpu_utilization_pct: number;
  cpu_peak_pct?: number | null;
  cpu_used_cores: number;
  ram_utilization_pct: number;
  ram_used_gib: number;
  storage_used_gib: number;
  network_egress_gib: number;
  is_synthetic: boolean;
}

export interface PlacementRecommendation {
  workload_id: string;
  current_placement: string;
  recommended_placement: string;
  status: RecommendationStatus;
  current_monthly_cost: number;
  recommended_monthly_cost: number;
  projected_monthly_savings: number;
  currency: Currency;
  billing_period: BillingPeriod;
  capacity_allocated_cpu: number;
  capacity_allocated_ram_gib: number;
  capacity_allocated_storage_gib: number;
  co_location_group_id?: string | null;
  co_located_workload_ids: string[];
  hard_compliance_passed: boolean;
  factors: string[];
  assumptions: string[];
  audit_explanation: string;
  rule_engine_version: string;
}

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

export interface ReviewAlert {
  alert_id: string;
  workload_id: string;
  created_at: string;
  trigger_type: AlertTriggerType;
  severity: AlertSeverity;
  title: string;
  summary: string;
  previous_placement?: string | null;
  new_placement?: string | null;
  cost_delta?: number | null;
  currency: Currency;
  status: AlertStatus;
  audit_rationale: string;
}

export interface EstateOverview {
  total_workloads: number;
  total_current_monthly_cost: number;
  total_recommended_monthly_cost: number;
  total_monthly_savings: number;
  savings_percentage: number;
  retained_in_dc_count: number;
  moved_to_cloud_count: number;
  dc_cpu_used: number;
  dc_cpu_usable: number;
  dc_cpu_total: number;
  dc_ram_used_gib: number;
  dc_ram_usable_gib: number;
  dc_ram_total_gib: number;
  dc_storage_used_gib: number;
  dc_storage_usable_gib: number;
  dc_storage_total_gib: number;
  dc_freed_cpu: number;
  dc_freed_ram_gib: number;
  dc_freed_storage_gib: number;
}


export interface ServerConfigurationState {
  // Hired Server configuration
  rentedServerCount?: number | string;
  cpuCoresPerServer?: number | string;
  ramGbPerServer?: number | string;
  monthlyRentalCostPerServer?: number | string;
  rentalCostUnknown?: boolean;
  avgCpuUtilizationPct?: number | string;
  cpuUtilizationUnknown?: boolean;
  avgRamUtilizationPct?: number | string;
  ramUtilizationUnknown?: boolean;

  // Local Server configuration (for Local + Hired Server)
  localCpuCores?: number | string;
  localRamGb?: number | string;
  localCapacityUtilPct?: number | string;
  localUtilizationUnknown?: boolean;
  localOperatingCostMonthly?: number | string;
  localCostUnknown?: boolean;

  // Workload Demand
  workloadDemandCpu?: number | string;
  workloadDemandRam?: number | string;
  workloadDemandUnknown?: boolean;

  // Workload Constraints (for Local + Hired Server)
  residencyConstraint?: DataResidencyRequirement;
  coLocationRequirement?: boolean;
  workloadNotes?: string;
}

export type CapacityClassification =
  | 'UNDER_PROVISIONED'
  | 'APPROXIMATELY_MATCHED'
  | 'POTENTIALLY_OVER_PROVISIONED'
  | 'INSUFFICIENT_DATA';

export interface CapacityAnalysisResult {
  setup: 'hired' | 'hybrid';
  totalAvailableCpu: number;
  totalAvailableRamGb: number;
  localAvailableCpu: number;
  localAvailableRamGb: number;
  rentedAvailableCpu: number;
  rentedAvailableRamGb: number;
  demandCpu: number | null;
  demandRamGb: number | null;
  cpuUtilizationPct: number | null;
  ramUtilizationPct: number | null;
  monthlyEstimatedCost: number | null;
  cpuDelta: number | null; // available - required (> 0 excess, < 0 shortfall)
  ramDelta: number | null;
  cpuShortfall: boolean;
  ramShortfall: boolean;
  classification: CapacityClassification;
  classificationLabel: string;
  explanation: string;
  suggestedAllocation?: {
    localWorkloadCores: number;
    localWorkloadRamGb: number;
    rentedWorkloadCores: number;
    rentedWorkloadRamGb: number;
    rationale: string;
  };
  missingDataWarnings: string[];
}

