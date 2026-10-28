from datetime import datetime, timezone
from typing import Optional
from app.models.enums import AlertSeverity, AlertStatus, AlertTriggerType, Currency, RecommendationStatus
from app.models.schemas import PlacementRecommendation, ReviewAlert, Workload


def generate_review_alerts(
    workloads: list[Workload],
    recommendations: list[PlacementRecommendation],
) -> list[ReviewAlert]:
    """Generates deterministic review alerts based on recommendation outcomes."""
    alerts: list[ReviewAlert] = []
    recs_by_id = {r.workload_id: r for r in recommendations}

    now_utc = datetime.now(timezone.utc)

    for w in sorted(workloads, key=lambda x: x.id):
        r = recs_by_id.get(w.id)
        if not r:
            continue

        if r.status == RecommendationStatus.CHANGE_RECOMMENDED:
            savings = r.projected_monthly_savings or 0.0
            severity = AlertSeverity.INFO if savings >= 0 else AlertSeverity.WARNING
            cost_delta = -savings  # new - old
            alerts.append(
                ReviewAlert(
                    alert_id=f"alert-change-{w.id}",
                    workload_id=w.id,
                    created_at=now_utc,
                    trigger_type=AlertTriggerType.PLACEMENT_CHANGED_OVER_TIME,
                    severity=severity,
                    title=f"Placement change recommended: {w.name}",
                    summary=(
                        f"Recommended placement changed from '{r.current_placement}' to '{r.recommended_placement}'. "
                        f"Projected monthly variance: {cost_delta:+,.2f} INR."
                    ),
                    previous_placement=r.current_placement,
                    new_placement=r.recommended_placement,
                    cost_delta=cost_delta,
                    currency=Currency.INR,
                    status=AlertStatus.ACTIVE,
                    audit_rationale=r.audit_explanation,
                )
            )

        elif r.status == RecommendationStatus.INELIGIBLE:
            alerts.append(
                ReviewAlert(
                    alert_id=f"alert-ineligible-{w.id}",
                    workload_id=w.id,
                    created_at=now_utc,
                    trigger_type=AlertTriggerType.CAPACITY_THRESHOLD_BREACHED,
                    severity=AlertSeverity.CRITICAL,
                    title=f"Infeasible placement for workload: {w.name}",
                    summary=f"No candidate placement satisfies compliance and capacity rules for '{w.id}'.",
                    previous_placement=r.current_placement,
                    new_placement=None,
                    cost_delta=None,
                    currency=Currency.INR,
                    status=AlertStatus.ACTIVE,
                    audit_rationale=r.audit_explanation,
                )
            )

        elif r.status == RecommendationStatus.REVIEW_REQUIRED:
            alerts.append(
                ReviewAlert(
                    alert_id=f"alert-review-req-{w.id}",
                    workload_id=w.id,
                    created_at=now_utc,
                    trigger_type=AlertTriggerType.NEW_COMPLIANCE_RESTRICTION,
                    severity=AlertSeverity.WARNING,
                    title=f"Manual review required: {w.name}",
                    summary=f"Workload specifications contain missing or contradictory information.",
                    previous_placement=r.current_placement,
                    new_placement=None,
                    cost_delta=None,
                    currency=Currency.INR,
                    status=AlertStatus.ACTIVE,
                    audit_rationale=r.audit_explanation,
                )
            )

    return alerts
