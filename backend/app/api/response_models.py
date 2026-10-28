"""Pydantic response models for the Sky Cash API.

Wraps engine domain objects into stable, documented API contracts.
"""

from typing import Optional
from pydantic import BaseModel, Field

from app.models.schemas import (
    PlacementRecommendation,
    PrivateDCAssumptions,
    PublicCloudRegion,
    ReviewAlert,
    ScenarioEvaluationReport,
    ScenarioSummary,
    UtilisationHistory,
    Workload,
)


class HealthResponse(BaseModel):
    status: str


class WorkloadListResponse(BaseModel):
    """Paginated workload inventory."""
    total: int = Field(..., description="Total workloads matching filters.")
    data_source: str = Field(..., description="Data origin: 'synthetic' or 'supplied'.")
    workloads: list[Workload]


class WorkloadDetailResponse(BaseModel):
    """Single workload with its placement recommendation."""
    workload: Workload
    recommendation: Optional[PlacementRecommendation] = None


class RecommendationListResponse(BaseModel):
    """All placement recommendations."""
    total: int
    recommendations: list[PlacementRecommendation]


class AlertListResponse(BaseModel):
    """Review alerts generated from recommendation outcomes."""
    total: int
    alerts: list[ReviewAlert]


class UtilisationListResponse(BaseModel):
    """Utilisation history records."""
    total: int
    records: list[UtilisationHistory]


class AssumptionsResponse(BaseModel):
    """Operational assumptions and methodology."""
    data_source: str
    dc_assumptions: PrivateDCAssumptions
    cloud_regions: list[PublicCloudRegion]
    methodology: list[str]
    limitations: list[str]


class ErrorResponse(BaseModel):
    """Stable error envelope for server-side failures."""

    detail: str
