"""Sky Cash API routes.

All placement logic is delegated to engine services.
Route handlers load data, call the engine, and format responses.

CONFIDENTIALITY: No workload data leaves the local process boundary.
"""

from typing import Optional, Union

from fastapi import APIRouter, HTTPException, Path, Query

from app.api.auth import router as auth_router
from app.api.response_models import (
    AlertListResponse,
    AssumptionsResponse,
    ErrorResponse,
    HealthResponse,
    RecommendationListResponse,
    UtilisationListResponse,
    WorkloadDetailResponse,
    WorkloadListResponse,
)
from app.engine.alerts import generate_review_alerts
from app.engine.evaluator import RULE_ENGINE_VERSION, evaluate_workloads
from app.engine.placement_modes import evaluate_placement_flow
from app.engine.scenarios import (
    ESTIMATE_DISCLAIMER,
    SIGN_CONVENTION_NOTE,
    evaluate_scenario_report,
)
from app.models.enums import (
    DataResidencyRequirement,
    DataSensitivity,
    PlacementStrategyMode,
)
from app.models.schemas import (
    DependencyGraph,
    PlacementFlowEvaluation,
    PlacementRecommendation,
    PrivateDCAssumptions,
    PublicCloudRegion,
    ReviewAlert,
    ScenarioEvaluationReport,
    ScenarioSummary,
    UtilisationHistory,
    Workload,
)
from app.services.data_loader import LoadedData, load_all_data


router = APIRouter(
    prefix="/api",
    tags=["Sky Cash Decision Support"],
    responses={
        503: {
            "model": ErrorResponse,
            "description": "Local input files are unavailable or invalid.",
        }
    },
)

# Mount authentication router under /api/auth
router.include_router(auth_router)


def _load_api_data() -> LoadedData:
    """Load local data without exposing paths or confidential values in errors."""
    try:
        return load_all_data()
    except (OSError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Local data could not be loaded or validated.",
        ) from exc


# --------------------------------------------------------------------------
# GET /api/health — API Health Check (used by frontend service detection)
# --------------------------------------------------------------------------
@router.get("/health", response_model=HealthResponse)
def api_health() -> HealthResponse:
    """API health probe endpoint."""
    return HealthResponse(status="ok")


# --------------------------------------------------------------------------
# GET /api/datacenter — Data Centre Assumptions
# --------------------------------------------------------------------------
@router.get("/datacenter", response_model=PrivateDCAssumptions)
def get_datacenter() -> PrivateDCAssumptions:
    """Return Private Data Centre capacity and cost assumptions."""
    data = _load_api_data()
    return data.dc_assumptions


# --------------------------------------------------------------------------
# GET /api/regions — Cloud Regions
# --------------------------------------------------------------------------
@router.get("/regions", response_model=list[PublicCloudRegion])
def get_regions() -> list[PublicCloudRegion]:
    """Return approved public cloud regions and rates."""
    data = _load_api_data()
    return data.cloud_regions


# --------------------------------------------------------------------------
# GET /api/dependencies — Dependency Graph
# --------------------------------------------------------------------------
@router.get("/dependencies", response_model=DependencyGraph)
def get_dependencies() -> DependencyGraph:
    """Return workload dependency graph and co-location groups."""
    data = _load_api_data()
    return data.dependency_graph


# --------------------------------------------------------------------------
# GET /api/workloads — List workloads with optional filters
# --------------------------------------------------------------------------
@router.get("/workloads", response_model=Union[list[Workload], WorkloadListResponse])
def list_workloads(
    environment: Optional[str] = Query(None, min_length=1, max_length=64, description="Filter by environment."),
    sensitivity: Optional[DataSensitivity] = Query(None, description="Filter by data sensitivity."),
    residency: Optional[DataResidencyRequirement] = Query(None, description="Filter by residency requirement."),
    search: Optional[str] = Query(None, min_length=1, max_length=128, description="Case-insensitive workload name or ID substring."),
    envelope: bool = Query(False, description="When true, wrap result in WorkloadListResponse envelope."),
) -> Union[list[Workload], WorkloadListResponse]:
    """Return all workloads, optionally filtered. Returns array by default for frontend compatibility."""
    data = _load_api_data()
    result = data.workloads

    if environment:
        result = [w for w in result if w.environment.lower() == environment.lower()]
    if sensitivity:
        result = [w for w in result if w.data_sensitivity == sensitivity]
    if residency:
        result = [w for w in result if w.residency_requirement == residency]
    if search:
        q = search.lower()
        result = [w for w in result if q in w.id.lower() or q in w.name.lower()]

    if envelope:
        return WorkloadListResponse(
            total=len(result),
            data_source=data.data_source,
            workloads=result,
        )
    return result


# --------------------------------------------------------------------------
# GET /api/workloads/{workload_id} — Single workload + recommendation
# --------------------------------------------------------------------------
@router.get(
    "/workloads/{workload_id}",
    response_model=WorkloadDetailResponse,
    responses={404: {"model": ErrorResponse, "description": "Workload not found"}},
)
def get_workload_detail(
    workload_id: str = Path(..., min_length=1, max_length=128, description="Workload identifier."),
) -> WorkloadDetailResponse:
    """Return a single workload and its placement recommendation."""
    data = _load_api_data()
    workload = next((w for w in data.workloads if w.id == workload_id), None)
    if workload is None:
        raise HTTPException(status_code=404, detail=f"Workload '{workload_id}' not found.")

    recommendations = evaluate_workloads(
        workloads=data.workloads,
        dc=data.dc_assumptions,
        cloud_regions=data.cloud_regions,
        dependency_graph=data.dependency_graph,
        utilisation=data.utilisation_history,
    )
    rec = next((r for r in recommendations if r.workload_id == workload_id), None)

    return WorkloadDetailResponse(workload=workload, recommendation=rec)


# --------------------------------------------------------------------------
# GET /api/recommendations — All placement recommendations
# --------------------------------------------------------------------------
@router.get("/recommendations", response_model=Union[list[PlacementRecommendation], RecommendationListResponse])
def list_recommendations(
    envelope: bool = Query(False, description="When true, wrap result in RecommendationListResponse envelope."),
) -> Union[list[PlacementRecommendation], RecommendationListResponse]:
    """Return all placement recommendations. Returns array by default for frontend compatibility."""
    data = _load_api_data()
    recommendations = evaluate_workloads(
        workloads=data.workloads,
        dc=data.dc_assumptions,
        cloud_regions=data.cloud_regions,
        dependency_graph=data.dependency_graph,
        utilisation=data.utilisation_history,
    )
    if envelope:
        return RecommendationListResponse(
            total=len(recommendations),
            recommendations=recommendations,
        )
    return recommendations


# --------------------------------------------------------------------------
# GET /api/recommendations/{workload_id} — Single recommendation
# --------------------------------------------------------------------------
@router.get(
    "/recommendations/{workload_id}",
    response_model=PlacementRecommendation,
    responses={404: {"model": ErrorResponse, "description": "Recommendation not found"}},
)
def get_recommendation(
    workload_id: str = Path(..., min_length=1, max_length=128, description="Workload identifier."),
) -> PlacementRecommendation:
    """Return the placement recommendation for a specific workload."""
    data = _load_api_data()

    # Verify workload exists
    workload = next((w for w in data.workloads if w.id == workload_id), None)
    if workload is None:
        raise HTTPException(status_code=404, detail=f"Workload '{workload_id}' not found.")

    recommendations = evaluate_workloads(
        workloads=data.workloads,
        dc=data.dc_assumptions,
        cloud_regions=data.cloud_regions,
        dependency_graph=data.dependency_graph,
        utilisation=data.utilisation_history,
    )
    rec = next((r for r in recommendations if r.workload_id == workload_id), None)
    if rec is None:
        raise HTTPException(status_code=404, detail=f"Recommendation for workload '{workload_id}' not generated.")

    return rec


# --------------------------------------------------------------------------
# GET /api/scenarios — Full scenario evaluation report
# --------------------------------------------------------------------------
@router.get("/scenarios", response_model=ScenarioEvaluationReport)
def list_scenarios() -> ScenarioEvaluationReport:
    """Return the full scenario evaluation report comparing current, recommended, and alternative placements."""
    data = _load_api_data()
    return evaluate_scenario_report(
        workloads=data.workloads,
        dc=data.dc_assumptions,
        cloud_regions=data.cloud_regions,
        dependency_graph=data.dependency_graph,
        utilisation=data.utilisation_history,
    )


# --------------------------------------------------------------------------
# GET /api/scenarios/{scenario_id} — Single scenario summary
# --------------------------------------------------------------------------
@router.get(
    "/scenarios/{scenario_id}",
    response_model=ScenarioSummary,
    responses={404: {"model": ErrorResponse, "description": "Scenario not found"}},
)
def get_scenario(
    scenario_id: str = Path(..., min_length=1, max_length=128, description="Scenario identifier."),
) -> ScenarioSummary:
    """Return a single scenario summary by ID."""
    data = _load_api_data()
    report = evaluate_scenario_report(
        workloads=data.workloads,
        dc=data.dc_assumptions,
        cloud_regions=data.cloud_regions,
        dependency_graph=data.dependency_graph,
        utilisation=data.utilisation_history,
    )

    # Search across current, recommended, and alternatives
    all_scenarios = [report.current_scenario, report.recommended_scenario] + report.alternative_scenarios
    match = next((s for s in all_scenarios if s.scenario_id == scenario_id), None)
    if match is None:
        valid_ids = [s.scenario_id for s in all_scenarios]
        raise HTTPException(
            status_code=404,
            detail=f"Scenario '{scenario_id}' not found. Valid IDs: {valid_ids}",
        )
    return match


# --------------------------------------------------------------------------
# GET /api/flow/evaluation — Strategy mode flow evaluation
# --------------------------------------------------------------------------
@router.get(
    "/flow/evaluation",
    response_model=PlacementFlowEvaluation,
    responses={
        422: {"model": ErrorResponse, "description": "Invalid query parameter supplied."},
        500: {"model": ErrorResponse, "description": "Placement evaluation failed."},
    },
)
def get_flow_evaluation(
    mode: str = Query(
        "HYBRID",
        description="Strategy mode: 'CLOUD_ONLY' (hired servers only) or 'HYBRID' (local + hired servers). Defaults to 'HYBRID'.",
    ),
) -> PlacementFlowEvaluation:
    """Evaluates the workload placement flow according to the selected strategy mode.

    - 'CLOUD_ONLY': Evaluates 100% public cloud placement on approved Indian regions.
    - 'HYBRID': Evaluates and compares Local-Only and Hybrid placements, recommending the lowest-cost feasible option.
    """
    mode_upper = mode.strip().upper()
    try:
        strategy_mode = PlacementStrategyMode(mode_upper)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid strategy mode '{mode}'. Allowed values: 'CLOUD_ONLY', 'HYBRID'.",
        )

    data = _load_api_data()
    try:
        return evaluate_placement_flow(
            mode=strategy_mode,
            workloads=data.workloads,
            dc=data.dc_assumptions,
            cloud_regions=data.cloud_regions,
            dependency_graph=data.dependency_graph,
            utilisation=data.utilisation_history,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unexpected failure during placement flow evaluation.",
        ) from exc


# --------------------------------------------------------------------------
# GET /api/utilisation — Utilisation history records
# --------------------------------------------------------------------------
@router.get("/utilisation", response_model=Union[list[UtilisationHistory], UtilisationListResponse])
def list_utilisation(
    workload_id: Optional[str] = Query(None, min_length=1, max_length=128, description="Filter by workload ID."),
    envelope: bool = Query(False, description="When true, wrap result in UtilisationListResponse envelope."),
) -> Union[list[UtilisationHistory], UtilisationListResponse]:
    """Return utilisation history records. Returns array by default for frontend compatibility."""
    data = _load_api_data()
    records = data.utilisation_history

    if workload_id:
        records = [u for u in records if u.workload_id == workload_id]

    if envelope:
        return UtilisationListResponse(total=len(records), records=records)
    return records


# --------------------------------------------------------------------------
# GET /api/alerts — Review alerts
# --------------------------------------------------------------------------
@router.get("/alerts", response_model=Union[list[ReviewAlert], AlertListResponse])
def list_alerts(
    envelope: bool = Query(False, description="When true, wrap result in AlertListResponse envelope."),
) -> Union[list[ReviewAlert], AlertListResponse]:
    """Return review alerts. Returns array by default for frontend compatibility."""
    data = _load_api_data()
    recommendations = evaluate_workloads(
        workloads=data.workloads,
        dc=data.dc_assumptions,
        cloud_regions=data.cloud_regions,
        dependency_graph=data.dependency_graph,
        utilisation=data.utilisation_history,
    )
    alerts = generate_review_alerts(data.workloads, recommendations)
    if envelope:
        return AlertListResponse(total=len(alerts), alerts=alerts)
    return alerts


# --------------------------------------------------------------------------
# GET /api/assumptions — Operational assumptions and methodology
# --------------------------------------------------------------------------
@router.get("/assumptions", response_model=AssumptionsResponse)
def get_assumptions() -> AssumptionsResponse:
    """Return data centre assumptions, cloud region configs, and methodology notes."""
    data = _load_api_data()
    return AssumptionsResponse(
        data_source=data.data_source,
        dc_assumptions=data.dc_assumptions,
        cloud_regions=data.cloud_regions,
        methodology=[
            f"Decision Engine Version: {RULE_ENGINE_VERSION}",
            "Hard compliance constraints (residency, sensitivity, certifications, approval status) "
            "are evaluated before any cost scoring. They can never be overridden.",
            "Cost is calculated as fully burdened monthly amortized rates for Private DC "
            "(compute + RAM + storage × PUE overhead) and on-demand pricing for Public Cloud "
            "(compute + RAM + storage + egress).",
            SIGN_CONVENTION_NOTE,
            ESTIMATE_DISCLAIMER,
            "Deterministic tie-breaking: lowest cost → current placement → Private DC → alphabetical ID.",
            "Co-location groups are computed via union-find on mandatory dependency edges.",
        ],
        limitations=[
            "Authentication is provided via local-first session store (BUTANE gateway).",
            "No real-time cloud pricing integration; uses static documented assumptions.",
            "Heuristic greedy placement, not a provably optimal optimizer.",
            "Egress volumes are modeled from telemetry history; unconfirmed values default to 0.0 GiB/month.",
            "All data stays local. No data is transmitted to third-party services.",
        ],
    )
