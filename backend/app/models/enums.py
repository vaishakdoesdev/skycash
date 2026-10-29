from enum import Enum


class DataSensitivity(str, Enum):
    """Data sensitivity classification level.
    Hard constraint: Restricts placement to eligible environments.
    """
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    CONFIDENTIAL = "CONFIDENTIAL"
    RESTRICTED = "RESTRICTED"


class DataResidencyRequirement(str, Enum):
    """Geographic residency requirement for data and workload execution.
    Hard constraint: Prohibits placement outside required boundaries.
    """
    KARNATAKA_DC_ONLY = "KARNATAKA_DC_ONLY"
    INDIA_ONLY = "INDIA_ONLY"
    ANY_APPROVED_REGION = "ANY_APPROVED_REGION"


class DependencyType(str, Enum):
    """Type of dependency relationship between two workloads."""
    CO_LOCATE = "CO_LOCATE"          # Hard requirement: must reside in the exact same placement
    LOW_LATENCY = "LOW_LATENCY"      # Soft/performance: prefers low round-trip latency
    LOOSE_COUPLING = "LOOSE_COUPLING"  # Tolerant to cross-region WAN network latency


class PlacementType(str, Enum):
    """Target hosting environment category."""
    PRIVATE_DC = "PRIVATE_DC"
    PUBLIC_CLOUD = "PUBLIC_CLOUD"


class PlacementStrategyMode(str, Enum):
    """User-selected strategy mode for workload placement evaluation."""
    CLOUD_ONLY = "CLOUD_ONLY"  # Hired servers only
    HYBRID = "HYBRID"          # Local + hired servers


class ApprovalStatus(str, Enum):
    """Administrative approval state of a hosting environment or region."""
    APPROVED = "APPROVED"
    PROVISIONAL = "PROVISIONAL"
    RESTRICTED = "RESTRICTED"
    UNAPPROVED = "UNAPPROVED"


class BillingPeriod(str, Enum):
    """Explicit billing duration unit."""
    HOURLY = "HOURLY"
    MONTHLY = "MONTHLY"
    ANNUAL = "ANNUAL"


class Currency(str, Enum):
    """Explicit ISO 4217 currency code."""
    INR = "INR"
    USD = "USD"


class TimeGranularity(str, Enum):
    """Time aggregation granularity for historical data."""
    HOURLY = "HOURLY"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"


class RecommendationStatus(str, Enum):
    """Status of placement recommendation evaluation."""
    ELIGIBLE = "ELIGIBLE"
    INELIGIBLE = "INELIGIBLE"
    NO_CHANGE = "NO_CHANGE"
    CHANGE_RECOMMENDED = "CHANGE_RECOMMENDED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class ViolationSeverity(str, Enum):
    """Severity of a compliance constraint violation."""
    HARD_VIOLATION = "HARD_VIOLATION"  # Outright disqualifies candidate placement
    POLICY_WARNING = "POLICY_WARNING"  # Soft advisory, does not disqualify placement


class AlertSeverity(str, Enum):
    """Urgency level of a review alert."""
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertTriggerType(str, Enum):
    """Trigger category causing a review alert to be generated."""
    PLACEMENT_CHANGED_OVER_TIME = "PLACEMENT_CHANGED_OVER_TIME"
    CAPACITY_THRESHOLD_BREACHED = "CAPACITY_THRESHOLD_BREACHED"
    COST_VARIANCE_SPIKE = "COST_VARIANCE_SPIKE"
    NEW_COMPLIANCE_RESTRICTION = "NEW_COMPLIANCE_RESTRICTION"


class AlertStatus(str, Enum):
    """Operational lifecycle state of a review alert."""
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
