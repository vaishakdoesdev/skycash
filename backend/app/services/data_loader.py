"""Data loading service.

Loads workload inventory and operational assumptions from local JSON files.
Falls back to deterministic synthetic demo data when supplied inventory is unavailable.

CONFIDENTIALITY: All data is loaded from and stays on the local file system.
No data is ever transmitted to third-party services.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from app.models.schemas import (
    DependencyGraph,
    PrivateDCAssumptions,
    PublicCloudRegion,
    UtilisationHistory,
    Workload,
)

# ---------------------------------------------------------------------------
# Path constants
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[3]  # D:\skycash
_SYNTHETIC_DIR = _PROJECT_ROOT / "data" / "synthetic"
_INPUT_DIR = _PROJECT_ROOT / "data" / "input"


@dataclass(frozen=True)
class LoadedData:
    """Immutable container for all loaded domain data."""

    workloads: list[Workload]
    dependency_graph: DependencyGraph
    dc_assumptions: PrivateDCAssumptions
    cloud_regions: list[PublicCloudRegion]
    utilisation_history: list[UtilisationHistory]
    data_source: str  # "synthetic" or "supplied"


# ---------------------------------------------------------------------------
# Module-level cache
# ---------------------------------------------------------------------------
_cached_data: Optional[LoadedData] = None


def _load_json(path: Path) -> object:
    """Read and parse a JSON file from the local file system."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _resolve_data_dir() -> tuple[Path, str]:
    """Returns (data_directory, source_label).

    Prefers supplied inventory in data/input/ if all required files exist;
    otherwise falls back to data/synthetic/.
    """
    required_files = [
        "workloads.json",
        "dependencies.json",
        "datacenter_assumptions.json",
        "cloud_regions.json",
        "utilisation_history.json",
    ]
    if _INPUT_DIR.is_dir() and all((_INPUT_DIR / f).is_file() for f in required_files):
        return _INPUT_DIR, "supplied"
    return _SYNTHETIC_DIR, "synthetic"


def load_all_data(*, force_reload: bool = False) -> LoadedData:
    """Load and validate all domain data.

    Returns a cached result on subsequent calls unless ``force_reload`` is True.
    """
    global _cached_data
    if _cached_data is not None and not force_reload:
        return _cached_data

    data_dir, source = _resolve_data_dir()

    # 1. Workloads
    raw_workloads = _load_json(data_dir / "workloads.json")
    workloads = [Workload.model_validate(w) for w in raw_workloads]

    # 2. Dependency graph
    raw_deps = _load_json(data_dir / "dependencies.json")
    dependency_graph = DependencyGraph.model_validate(raw_deps)

    # 3. DC assumptions
    raw_dc = _load_json(data_dir / "datacenter_assumptions.json")
    dc_assumptions = PrivateDCAssumptions.model_validate(raw_dc)

    # 4. Cloud regions
    raw_clouds = _load_json(data_dir / "cloud_regions.json")
    cloud_regions = [PublicCloudRegion.model_validate(r) for r in raw_clouds]

    # 5. Utilisation history
    raw_util = _load_json(data_dir / "utilisation_history.json")
    utilisation_history = [UtilisationHistory.model_validate(u) for u in raw_util]

    loaded = LoadedData(
        workloads=workloads,
        dependency_graph=dependency_graph,
        dc_assumptions=dc_assumptions,
        cloud_regions=cloud_regions,
        utilisation_history=utilisation_history,
        data_source=source,
    )

    _cached_data = loaded
    return loaded


def invalidate_cache() -> None:
    """Clear the in-memory data cache so the next load reads from disk."""
    global _cached_data
    _cached_data = None
