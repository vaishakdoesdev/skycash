from dataclasses import dataclass, field
from typing import Optional, Union
from app.models.enums import (
    ApprovalStatus,
    DataResidencyRequirement,
    DataSensitivity,
    ViolationSeverity,
)
from app.models.schemas import (
    ComplianceViolation,
    PrivateDCAssumptions,
    PublicCloudRegion,
    Workload,
)

# Standard accredited certifications satisfied by the on-premise Karnataka DC
PRIVATE_DC_CERTIFICATIONS = {
    "RBI_LOCALIZATION",
    "ISO27001",
    "MEITY_EMPANELLED",
    "SOC2",
}


@dataclass
class ComplianceCheckResult:
    is_eligible: bool
    violations: list[ComplianceViolation] = field(default_factory=list)
    binding_constraints: list[str] = field(default_factory=list)
    rejection_reason: Optional[str] = None


def evaluate_placement_compliance(
    workload: Workload,
    placement: Union[PrivateDCAssumptions, PublicCloudRegion],
) -> ComplianceCheckResult:
    """Evaluates hard compliance rules for a candidate placement.
    
    Hard non-negotiable rules:
      1. Administrative Approval Status (prohibits unapproved/restricted cloud regions).
      2. Data Residency Boundaries (KARNATAKA_DC_ONLY, INDIA_ONLY).
      3. Data Sensitivity Ceilings (prohibits classified data from ineligible regions).
      4. Regulatory & Security Certifications (e.g. RBI localization).
    """
    violations: list[ComplianceViolation] = []
    binding_constraints: list[str] = []

    is_private_dc = isinstance(placement, PrivateDCAssumptions)
    placement_id = placement.dc_id if is_private_dc else placement.region_id

    # -------------------------------------------------------------------------
    # 1. Approval Status Check
    # -------------------------------------------------------------------------
    if not is_private_dc:
        cloud_region: PublicCloudRegion = placement
        if cloud_region.approval_status not in (ApprovalStatus.APPROVED, ApprovalStatus.PROVISIONAL):
            v = ComplianceViolation(
                id=f"viol-approval-{workload.id}-{placement_id}",
                workload_id=workload.id,
                placement_id=placement_id,
                rule_name="CLOUD_REGION_APPROVAL_STATUS",
                severity=ViolationSeverity.HARD_VIOLATION,
                description=f"Cloud region {placement_id} has approval status {cloud_region.approval_status.value} (must be APPROVED or PROVISIONAL).",
                conflicting_attribute="approval_status",
                required_value="APPROVED | PROVISIONAL",
                actual_value=cloud_region.approval_status.value,
            )
            violations.append(v)
            binding_constraints.append(f"Region {placement_id} is not administratively approved.")

    # -------------------------------------------------------------------------
    # 2. Data Residency Check (Non-Negotiable)
    # -------------------------------------------------------------------------
    if workload.residency_requirement == DataResidencyRequirement.KARNATAKA_DC_ONLY:
        binding_constraints.append("Workload subject to strict Karnataka Private DC data residency mandate.")
        if not is_private_dc or placement.location_state != "Karnataka":
            v = ComplianceViolation(
                id=f"viol-residency-karnataka-{workload.id}-{placement_id}",
                workload_id=workload.id,
                placement_id=placement_id,
                rule_name="DATA_RESIDENCY_KARNATAKA_DC_ONLY",
                severity=ViolationSeverity.HARD_VIOLATION,
                description=f"Workload requires local Karnataka DC hosting; placement {placement_id} is located outside Karnataka DC.",
                conflicting_attribute="location_state",
                required_value="Karnataka (Private DC)",
                actual_value=getattr(placement, "location_state", getattr(placement, "location_city", "Unknown")),
            )
            violations.append(v)

    elif workload.residency_requirement == DataResidencyRequirement.INDIA_ONLY:
        binding_constraints.append("Workload subject to sovereign Indian data residency mandate (INDIA_ONLY).")
        placement_country = placement.location_country
        if placement_country != "IN":
            v = ComplianceViolation(
                id=f"viol-residency-india-{workload.id}-{placement_id}",
                workload_id=workload.id,
                placement_id=placement_id,
                rule_name="DATA_RESIDENCY_INDIA_ONLY",
                severity=ViolationSeverity.HARD_VIOLATION,
                description=f"Workload requires Indian sovereign boundary; placement {placement_id} country is {placement_country}.",
                conflicting_attribute="location_country",
                required_value="IN",
                actual_value=placement_country,
            )
            violations.append(v)

    # -------------------------------------------------------------------------
    # 3. Data Sensitivity Check (Non-Negotiable)
    # -------------------------------------------------------------------------
    if is_private_dc:
        # Private DC supports all enterprise classifications
        pass
    else:
        cloud_region = placement
        binding_constraints.append(f"Workload data sensitivity is {workload.data_sensitivity.value}.")
        if workload.data_sensitivity not in cloud_region.allowed_sensitivities:
            allowed_str = ", ".join(s.value for s in cloud_region.allowed_sensitivities)
            v = ComplianceViolation(
                id=f"viol-sensitivity-{workload.id}-{placement_id}",
                workload_id=workload.id,
                placement_id=placement_id,
                rule_name="DATA_SENSITIVITY_CEILING",
                severity=ViolationSeverity.HARD_VIOLATION,
                description=f"Region {placement_id} permits sensitivities [{allowed_str}], which does not admit workload classification {workload.data_sensitivity.value}.",
                conflicting_attribute="data_sensitivity",
                required_value=f"One of [{allowed_str}]",
                actual_value=workload.data_sensitivity.value,
            )
            violations.append(v)

    # -------------------------------------------------------------------------
    # 4. Mandatory Regulatory Certifications Check
    # -------------------------------------------------------------------------
    available_certs = set(PRIVATE_DC_CERTIFICATIONS if is_private_dc else placement.compliance_certifications)
    for req_cert in workload.required_certifications:
        binding_constraints.append(f"Mandatory compliance certification: {req_cert}.")
        if req_cert not in available_certs:
            v = ComplianceViolation(
                id=f"viol-cert-{workload.id}-{placement_id}-{req_cert}",
                workload_id=workload.id,
                placement_id=placement_id,
                rule_name="MANDATORY_CERTIFICATION_MISSING",
                severity=ViolationSeverity.HARD_VIOLATION,
                description=f"Workload mandates {req_cert}, which placement {placement_id} does not possess.",
                conflicting_attribute="compliance_certifications",
                required_value=req_cert,
                actual_value="Missing",
            )
            violations.append(v)

    is_eligible = len(violations) == 0
    rejection_reason = None
    if not is_eligible:
        rejection_reason = "; ".join(v.description for v in violations)

    return ComplianceCheckResult(
        is_eligible=is_eligible,
        violations=violations,
        binding_constraints=list(dict.fromkeys(binding_constraints)),
        rejection_reason=rejection_reason,
    )
