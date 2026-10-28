from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    AlertSeverity,
    AlertStatus,
    AlertTriggerType,
    ApprovalStatus,
    BillingPeriod,
    Currency,
    DataResidencyRequirement,
    DataSensitivity,
    DependencyType,
    PlacementType,
    RecommendationStatus,
    TimeGranularity,
    ViolationSeverity,
)


# ==============================================================================
# 1. Workload Schema
# ==============================================================================

class WorkloadSoftPreferences(BaseModel):
    """Soft optimization preferences.
    Evaluated only AFTER hard residency and sensitivity compliance checks pass.
    """
    model_config = ConfigDict(extra="forbid")

    preferred_provider: Optional[str] = Field(
        default=None,
        description="Optional preferred cloud provider (e.g. AWS, Azure) or None if agnostic.",
    )
    target_monthly_budget: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Target monthly spending threshold in explicit currency, or None if unconstrained.",
    )
    max_acceptable_wan_latency_ms: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Desired latency threshold in milliseconds, or None if unconstrained.",
    )


class Workload(BaseModel):
    """Defines a discrete computational workload subject to placement decisions."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Unique immutable workload identifier (e.g. 'wl-core-banking-db').")
    name: str = Field(..., description="Human-readable workload name.")
    environment: str = Field(..., description="Operating lifecycle stage (e.g. 'production', 'staging', 'development').")
    current_placement: str = Field(..., description="Current location identifier (e.g. 'karnataka-dc-1' or 'aws-ap-south-1').")

    # Hard compliance constraints (non-negotiable eligibility)
    data_sensitivity: DataSensitivity = Field(
        ...,
        description="Classification level. High sensitivity restricts cloud eligibility.",
    )
    residency_requirement: DataResidencyRequirement = Field(
        ...,
        description="Geographic boundary rule. KARNATAKA_DC_ONLY or INDIA_ONLY must never be violated.",
    )
    required_certifications: list[str] = Field(
        default_factory=list,
        description="Mandatory compliance regimes (e.g. ['RBI_LOCALIZATION', 'ISO27001']). Explicitly empty if none.",
    )

    # Resource allocations (explicit capacity units)
    allocated_cpu_cores: float = Field(..., gt=0.0, description="Allocated compute capacity in vCPU / physical cores.")
    allocated_ram_gib: float = Field(..., gt=0.0, description="Allocated random-access memory in GiB.")
    allocated_storage_gib: float = Field(..., gt=0.0, description="Allocated persistent storage in GiB.")
    storage_tier: str = Field(
        default="SSD",
        description="Storage media grade: 'SSD', 'NVME', or 'HDD'. Explicitly declared.",
    )

    # Soft preferences (cannot override hard compliance rules)
    soft_preferences: Optional[WorkloadSoftPreferences] = Field(
        default=None,
        description="Optional optimization preferences. Explicitly None when absent.",
    )

    tags: dict[str, str] = Field(default_factory=dict, description="Metadata tags for categorization.")
    notes: Optional[str] = Field(default=None, description="Explicit operator notes or context. Explicitly None if absent.")


# ==============================================================================
# 2. Dependency Relationship Schema (Graph Modeling)
# ==============================================================================

class DependencyRelationship(BaseModel):
    """Explicit directed relationship record between two workloads: source -> target."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Unique relationship identifier (e.g. 'dep-api-to-db').")
    source_workload_id: str = Field(..., description="Workload initiating calls / having dependency.")
    target_workload_id: str = Field(..., description="Workload being depended upon.")
    relationship_type: DependencyType = Field(
        ...,
        description="CO_LOCATE (mandatory co-location), LOW_LATENCY (performance preferred), or LOOSE_COUPLING.",
    )
    is_mandatory: bool = Field(
        ...,
        description="True if co-location is a hard non-negotiable constraint; False if soft preference.",
    )
    max_tolerable_latency_ms: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Round-trip network latency ceiling in ms. Explicitly None if unknown or not measured.",
    )
    data_exchange_gb_per_month: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Estimated cross-boundary transfer volume in GiB/month. Explicitly None if unknown.",
    )
    notes: Optional[str] = Field(default=None, description="Relationship rationale or context.")


class DependencyGraph(BaseModel):
    """Aggregate dependency graph representing all nodes, edges, and co-location groups."""
    model_config = ConfigDict(extra="forbid")

    nodes: list[str] = Field(..., description="List of workload IDs present in the graph.")
    edges: list[DependencyRelationship] = Field(..., description="List of directed dependency records.")
    co_location_groups: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Mapping of group_id to member workload IDs that MUST remain co-located.",
    )


# ==============================================================================
# 3. Private Data Centre Capacity and Cost Assumptions
# ==============================================================================

class PrivateDCAssumptions(BaseModel):
    """Capacity bounds and fully burdened amortized cost baseline for the Karnataka private DC."""
    model_config = ConfigDict(extra="forbid")

    dc_id: str = Field(..., description="Data centre location ID (e.g. 'karnataka-dc-1').")
    name: str = Field(..., description="Facility name (e.g. 'Karnataka On-Premise Data Centre').")
    location_country: str = Field(default="IN", description="ISO 3166-1 alpha-2 country code.")
    location_state: str = Field(default="Karnataka", description="State / province location.")

    # Hardware capacity metrics (explicit capacity units)
    total_cpu_cores: float = Field(..., gt=0.0, description="Total installed physical/virtual CPU cores.")
    usable_cpu_cores: float = Field(..., gt=0.0, description="Usable CPU core limit accounting for hypervisor reserve.")
    total_ram_gib: float = Field(..., gt=0.0, description="Total installed RAM in GiB.")
    usable_ram_gib: float = Field(..., gt=0.0, description="Usable RAM in GiB after hypervisor reservation.")
    total_storage_gib: float = Field(..., gt=0.0, description="Total raw SAN/NAS storage in GiB.")
    usable_storage_gib: float = Field(..., gt=0.0, description="Usable persistent storage in GiB after RAID/parity reserve.")

    # Cost model (explicit units, currency, and period)
    currency: Currency = Field(default=Currency.INR, description="Billing currency standard.")
    billing_period: BillingPeriod = Field(default=BillingPeriod.MONTHLY, description="Standard accounting period.")
    amortized_cost_per_cpu_core_month: float = Field(..., ge=0.0, description="Fully amortized monthly hardware cost per vCPU in currency.")
    amortized_cost_per_ram_gib_month: float = Field(..., ge=0.0, description="Fully amortized monthly hardware cost per GiB RAM in currency.")
    amortized_cost_per_storage_gib_month: float = Field(..., ge=0.0, description="Fully amortized monthly cost per GiB storage in currency.")
    power_cooling_pue_overhead_pct: float = Field(..., ge=0.0, description="Facility PUE power/cooling multiplier overhead as percentage.")
    fixed_monthly_facility_cost: float = Field(..., ge=0.0, description="Fixed baseline floor expenses (racks, telecom links) per month.")

    assumptions_notes: str = Field(..., description="Documented justification and audit explanation for cost assumptions.")


# ==============================================================================
# 4. Public Cloud Region Capacity, Cost and Eligibility Rules
# ==============================================================================

class PublicCloudRegion(BaseModel):
    """Specification, pricing model, and compliance accreditation of an approved public cloud region."""
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(..., description="Cloud region identifier (e.g. 'aws-ap-south-1', 'azure-central-india').")
    provider: str = Field(..., description="Cloud service provider name (e.g. 'AWS', 'Azure', 'GCP').")
    region_name: str = Field(..., description="Official region description (e.g. 'Asia Pacific (Mumbai)').")
    location_country: str = Field(default="IN", description="Geographic jurisdiction (ISO 3166-1 alpha-2).")
    location_city: str = Field(..., description="Metro/city locality (e.g. 'Mumbai', 'Hyderabad').")

    approval_status: ApprovalStatus = Field(
        ...,
        description="Administrative status. Only APPROVED and PROVISIONAL regions are candidate targets.",
    )
    allowed_sensitivities: list[DataSensitivity] = Field(
        ...,
        description="Data sensitivity levels permitted in this region by corporate security policy.",
    )
    supports_residency_in: list[str] = Field(
        ...,
        description="List of sovereign jurisdiction codes satisfied by this region (e.g. ['IN']).",
    )
    compliance_certifications: list[str] = Field(
        default_factory=list,
        description="Audited compliance accreditations (e.g. ['RBI_LOCALIZATION', 'ISO27001', 'SOC2']).",
    )

    # Pricing structure (explicit currency and rate units)
    currency: Currency = Field(default=Currency.INR, description="Pricing currency.")
    billing_period: BillingPeriod = Field(default=BillingPeriod.MONTHLY, description="Standard billing calculation interval.")
    compute_rate_per_vcpu_month: float = Field(..., ge=0.0, description="Pay-as-you-go rate per vCPU-month in currency.")
    memory_rate_per_gib_month: float = Field(..., ge=0.0, description="Pay-as-you-go rate per GiB RAM-month in currency.")
    storage_ssd_rate_per_gib_month: float = Field(..., ge=0.0, description="General Purpose SSD storage rate per GiB-month in currency.")
    egress_rate_per_gib: float = Field(..., ge=0.0, description="Internet / cross-region outbound bandwidth rate per GiB in currency.")

    eligibility_rules: list[str] = Field(
        default_factory=list,
        description="Plain-text documentation of constraints applied to this region.",
    )


# ==============================================================================
# 5. Utilisation History Schema
# ==============================================================================

class UtilisationHistory(BaseModel):
    """Historical or monitored telemetry point for a workload over a fixed window."""
    model_config = ConfigDict(extra="forbid")

    workload_id: str = Field(..., description="Target workload identifier.")
    timestamp: datetime = Field(..., description="ISO 8601 UTC timestamp of measurement window start.")
    duration_hours: float = Field(..., gt=0.0, description="Window interval length in hours.")
    granularity: TimeGranularity = Field(..., description="Aggregation interval standard (HOURLY, DAILY, MONTHLY).")

    # Compute utilization (explicit units)
    cpu_utilization_pct: float = Field(..., ge=0.0, le=100.0, description="Average CPU utilization percentage over interval.")
    cpu_peak_pct: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Peak CPU utilization percentage observed. Explicitly None if not captured.",
    )
    cpu_used_cores: float = Field(..., ge=0.0, description="Effective average compute consumed in vCPU cores.")

    # Memory utilization (explicit units)
    ram_utilization_pct: float = Field(..., ge=0.0, le=100.0, description="Average RAM utilization percentage.")
    ram_used_gib: float = Field(..., ge=0.0, description="Effective memory consumed in GiB.")

    # Storage and network utilization (explicit units)
    storage_used_gib: float = Field(..., ge=0.0, description="Actual persistent disk space consumed in GiB.")
    network_egress_gib: float = Field(..., ge=0.0, description="Outbound data egress emitted in GiB during window.")

    is_synthetic: bool = Field(default=False, description="Explicit boolean flag indicating whether record is synthetic test data.")


# ==============================================================================
# 6. Placement Recommendation Schema
# ==============================================================================

class PlacementRecommendation(BaseModel):
    """Auditable, deterministic recommendation for a workload placement."""
    model_config = ConfigDict(extra="forbid")

    workload_id: str = Field(..., description="Subject workload identifier.")
    current_placement: str = Field(..., description="Current deployment location.")
    recommended_placement: Optional[str] = Field(
        default=None,
        description="Optimal defensible target location, or None if no feasible placement exists.",
    )
    status: RecommendationStatus = Field(
        ...,
        description="ELIGIBLE, INELIGIBLE, NO_CHANGE, CHANGE_RECOMMENDED, or REVIEW_REQUIRED.",
    )

    # Cost comparison (explicit currency and period)
    current_monthly_cost: float = Field(..., ge=0.0, description="Estimated monthly run cost in current location.")
    recommended_monthly_cost: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Projected monthly run cost in recommended placement, or None if ineligible.",
    )
    projected_monthly_savings: Optional[float] = Field(
        default=None,
        description="Net variance (current - recommended). Positive indicates savings. None if ineligible.",
    )
    currency: Currency = Field(default=Currency.INR, description="Accounting currency.")
    billing_period: BillingPeriod = Field(default=BillingPeriod.MONTHLY, description="Standard billing cycle.")

    # Capacity footprints (explicit units)
    capacity_allocated_cpu: float = Field(..., gt=0.0, description="Allocated compute in cores.")
    capacity_allocated_ram_gib: float = Field(..., gt=0.0, description="Allocated RAM in GiB.")
    capacity_allocated_storage_gib: float = Field(..., gt=0.0, description="Allocated persistent disk in GiB.")

    # Dependency & compliance audit
    co_location_group_id: Optional[str] = Field(
        default=None,
        description="Assigned co-location group identifier, or None if independent.",
    )
    co_located_workload_ids: list[str] = Field(
        default_factory=list,
        description="IDs of companion workloads co-located in the same placement.",
    )
    hard_compliance_passed: bool = Field(..., description="True only if all residency and sensitivity constraints are verified.")

    # Auditability & explainability
    factors: list[str] = Field(default_factory=list, description="Specific deterministic factors driving the recommendation.")
    binding_constraints: list[str] = Field(default_factory=list, description="Hard constraints that bounded or eliminated placements.")
    assumptions: list[str] = Field(default_factory=list, description="Operational assumptions applied during evaluation.")
    rejected_alternatives: dict[str, str] = Field(
        default_factory=dict,
        description="Map of rejected placement candidate IDs to explicit reason for rejection.",
    )
    audit_explanation: str = Field(..., description="Human-readable rationale challengeable in under two minutes.")
    rule_engine_version: str = Field(default="0.1.0", description="Deterministic decision policy version.")


# ==============================================================================
# 7. Cost and Capacity Scenario Schema
# ==============================================================================

class CostCapacityScenario(BaseModel):
    """Forward-looking capacity forecasting and price variance simulation scenario."""
    model_config = ConfigDict(extra="forbid")

    scenario_id: str = Field(..., description="Scenario identifier (e.g. 'growth-forecast-2027').")
    name: str = Field(..., description="Scenario name.")
    description: str = Field(..., description="Description of scenario premises.")
    timeframe_months: int = Field(..., gt=0, description="Projection duration in months.")

    # Growth and price modifiers (explicit percentages)
    cpu_growth_rate_pct: float = Field(..., description="Projected compute demand growth percentage (e.g. 15.0 for +15%).")
    ram_growth_rate_pct: float = Field(..., description="Projected memory demand growth percentage.")
    storage_growth_rate_pct: float = Field(..., description="Projected storage growth percentage.")
    cloud_cost_adjustment_pct: float = Field(default=0.0, description="Anticipated cloud pricing trend adjustment percentage.")
    private_dc_cost_adjustment_pct: float = Field(default=0.0, description="Anticipated private DC cost variation percentage.")

    # Projected outcomes (explicit units and currency)
    projected_total_dc_cpu_used: float = Field(..., ge=0.0, description="Forecasted aggregate private DC CPU cores required.")
    projected_total_dc_ram_gib_used: float = Field(..., ge=0.0, description="Forecasted aggregate private DC RAM GiB required.")
    projected_total_dc_storage_gib_used: float = Field(..., ge=0.0, description="Forecasted aggregate private DC storage GiB required.")
    projected_total_monthly_cost: float = Field(..., ge=0.0, description="Forecasted aggregate estate monthly spend.")
    currency: Currency = Field(default=Currency.INR, description="Projection currency.")


# ==============================================================================
# 8. Compliance Violation Schema
# ==============================================================================

class ComplianceViolation(BaseModel):
    """Explicit record of an evaluated placement violating a policy rule."""
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Violation identifier (e.g. 'viol-core-banking-geo').")
    workload_id: str = Field(..., description="Workload evaluated.")
    placement_id: str = Field(..., description="Placement location evaluated.")
    rule_name: str = Field(..., description="Specific rule identifier (e.g. 'DATA_RESIDENCY_KARNATAKA_DC_ONLY').")
    severity: ViolationSeverity = Field(
        ...,
        description="HARD_VIOLATION (strictly disqualifies placement) or POLICY_WARNING (soft alert).",
    )
    description: str = Field(..., description="Plain language explanation of the breach.")
    conflicting_attribute: str = Field(..., description="Attribute failing check (e.g. 'location_state').")
    required_value: str = Field(..., description="Required state (e.g. 'Karnataka').")
    actual_value: str = Field(..., description="Observed state in candidate placement (e.g. 'Maharashtra').")


# ==============================================================================
# 9. Review Alert Schema
# ==============================================================================

class ReviewAlert(BaseModel):
    """Notification alerting infrastructure leads that a workload placement warrants review."""
    model_config = ConfigDict(extra="forbid")

    alert_id: str = Field(..., description="Unique alert identifier.")
    workload_id: str = Field(..., description="Subject workload identifier.")
    created_at: datetime = Field(..., description="Timestamp of alert generation.")
    trigger_type: AlertTriggerType = Field(
        ...,
        description="Reason category (PLACEMENT_CHANGED_OVER_TIME, CAPACITY_THRESHOLD_BREACHED, etc.).",
    )
    severity: AlertSeverity = Field(..., description="Urgency: INFO, WARNING, or CRITICAL.")
    title: str = Field(..., description="Brief summary title.")
    summary: str = Field(..., description="Detailed explanation of the variance.")

    # Location transition
    previous_placement: Optional[str] = Field(default=None, description="Prior placement ID. Explicitly None if initial run.")
    new_placement: Optional[str] = Field(default=None, description="Newly recommended placement ID. Explicitly None if unplaced.")

    # Variance impact
    cost_delta: Optional[float] = Field(
        default=None,
        description="Cost delta per month (new - old). Explicitly None if not cost-driven.",
    )
    currency: Currency = Field(default=Currency.INR, description="Currency denomination.")

    status: AlertStatus = Field(default=AlertStatus.ACTIVE, description="Alert lifecycle state.")
    audit_rationale: str = Field(..., description="Deterministic decision path that triggered this alert.")


# ==============================================================================
# 10. Scenario Evaluation Schemas
# ==============================================================================

class OnPremiseResourceUtilization(BaseModel):
    """Resource consumption and headroom analysis for the private data centre."""
    model_config = ConfigDict(extra="forbid")

    dimension: str = Field(..., description="Resource dimension name (e.g. 'CPU Cores', 'RAM', 'Persistent Storage').")
    unit: str = Field(..., description="Measurement unit (e.g. 'cores', 'GiB').")
    allocated: float = Field(..., ge=0.0, description="Aggregate resource allocated across all on-premise workloads.")
    usable_capacity: float = Field(..., gt=0.0, description="Total usable capacity limit.")
    total_capacity: float = Field(..., gt=0.0, description="Total physical installed capacity.")
    utilization_pct: float = Field(..., ge=0.0, description="Percentage of usable capacity allocated.")
    headroom: float = Field(..., description="Remaining usable headroom (usable_capacity - allocated). Negative if violated.")
    is_violated: bool = Field(..., description="True if allocated exceeds usable capacity.")
    violation_amount: float = Field(default=0.0, ge=0.0, description="Capacity deficit if violated; 0.0 otherwise.")


class ScenarioPlacementBreakdown(BaseModel):
    """Per-workload placement outcome within a scenario."""
    model_config = ConfigDict(extra="forbid")

    workload_id: str = Field(..., description="Workload identifier.")
    workload_name: str = Field(..., description="Human-readable workload name.")
    current_placement: str = Field(..., description="Current deployment location.")
    assigned_placement: Optional[str] = Field(default=None, description="Assigned placement in this scenario, or None if unassigned.")
    monthly_cost: float = Field(..., ge=0.0, description="Estimated monthly run cost in assigned placement.")
    cost_delta_from_current: float = Field(..., description="Monthly cost delta (assigned - current). Negative = savings, Positive = increase.")
    cost_delta_pct_from_current: Optional[float] = Field(default=None, description="Percentage cost variance from current baseline.")
    is_compliant: bool = Field(..., description="True if assigned placement satisfies all hard compliance rules.")
    compliance_violations: list[str] = Field(default_factory=list, description="Descriptions of any compliance breaches.")
    assumptions: list[str] = Field(default_factory=list, description="Calculation assumptions applied.")


class ScenarioSummary(BaseModel):
    """Comprehensive evaluation of an estate-wide placement scenario."""
    model_config = ConfigDict(extra="forbid")

    scenario_id: str = Field(..., description="Unique scenario identifier.")
    scenario_name: str = Field(..., description="Scenario display title.")
    description: str = Field(..., description="Scenario premises and methodology description.")
    
    # Financial metrics
    projected_monthly_cost: float = Field(..., ge=0.0, description="Projected aggregate estate monthly run cost.")
    is_cost_estimate: bool = Field(default=True, description="Explicit disclaimer flag confirming metric is an estimate.")
    cost_estimate_disclaimer: str = Field(
        default="Projected estimate based on 720h/mo standard rates; not an actual billing statement.",
        description="Legal and financial disclaimer.",
    )
    cost_difference_absolute: float = Field(
        ...,
        description="Absolute variance (scenario_cost - current_cost). Negative = cost reduction/savings, Positive = cost increase.",
    )
    cost_difference_pct: float = Field(
        ...,
        description="Percentage variance relative to current baseline ((scenario - current) / current * 100).",
    )
    sign_convention: str = Field(
        default="Negative indicates cost reduction/savings compared to current baseline; positive indicates cost increase.",
        description="Formal sign convention definition.",
    )
    currency: Currency = Field(default=Currency.INR, description="Cost currency denomination.")
    billing_period: BillingPeriod = Field(default=BillingPeriod.MONTHLY, description="Standard billing interval.")

    # Capacity and resource utilization
    on_premise_utilization: list[OnPremiseResourceUtilization] = Field(
        default_factory=list,
        description="Dimension-by-dimension utilization breakdown for the Private DC.",
    )
    has_capacity_violations: bool = Field(..., description="True if any on-premise resource dimension exceeds usable capacity.")
    capacity_violations_count: int = Field(default=0, ge=0, description="Number of breached resource dimensions.")

    # Dependency preservation
    mandatory_dependency_groups_total: int = Field(default=0, ge=0, description="Total mandatory co-location groups in estate.")
    mandatory_dependency_groups_preserved: int = Field(default=0, ge=0, description="Mandatory groups kept co-located in this scenario.")
    mandatory_dependency_groups_fraction: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Fraction of mandatory groups preserved (1.0 = 100%).",
    )

    # Compliance
    compliance_violations_count: int = Field(default=0, ge=0, description="Total hard compliance violations across all workloads.")
    is_feasible: bool = Field(
        ...,
        description="True only if compliance_violations_count == 0, has_capacity_violations is False, and all dependencies are preserved.",
    )

    # Breakdown and audit
    per_workload_breakdown: list[ScenarioPlacementBreakdown] = Field(
        default_factory=list,
        description="Workload-by-workload assignment, cost, and compliance audit trail.",
    )
    unconfirmed_metrics: list[str] = Field(
        default_factory=list,
        description="List of metrics subject to unconfirmed assumptions (e.g. unknown egress).",
    )


class ScenarioEvaluationReport(BaseModel):
    """Aggregate comparison report evaluating current, recommended, and alternative scenarios."""
    model_config = ConfigDict(extra="forbid")

    generated_at: datetime = Field(..., description="Timestamp of report generation.")
    currency: Currency = Field(default=Currency.INR, description="Reporting currency standard.")
    billing_period: BillingPeriod = Field(default=BillingPeriod.MONTHLY, description="Duration interval standard.")
    current_scenario: ScenarioSummary = Field(..., description="Baseline evaluation of current workload placements.")
    recommended_scenario: ScenarioSummary = Field(..., description="Evaluation of decision-engine recommended placements.")
    alternative_scenarios: list[ScenarioSummary] = Field(
        default_factory=list,
        description="Evaluations of meaningful alternative feasible scenarios.",
    )
    audit_notes: list[str] = Field(default_factory=list, description="General methodology and policy notes.")
