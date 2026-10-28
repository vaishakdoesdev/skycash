from typing import Optional
from app.models.enums import DependencyType
from app.models.schemas import DependencyGraph, DependencyRelationship, Workload


def extract_co_location_clusters(
    graph: Optional[DependencyGraph],
) -> list[set[str]]:
    """Discovers all transitive clusters of workloads that MUST remain co-located.
    
    Uses disjoint-set (union-find) across:
      1. Explicit groups defined in graph.co_location_groups.
      2. Edges where relationship_type == CO_LOCATE and is_mandatory is True.
    """
    if not graph:
        return []

    parent: dict[str, str] = {}

    def find(i: str) -> str:
        if parent.setdefault(i, i) != i:
            parent[i] = find(parent[i])
        return parent[i]

    def union(i: str, j: str) -> None:
        root_i = find(i)
        root_j = find(j)
        if root_i != root_j:
            parent[root_i] = root_j

    # 1. Union explicit groups
    for group_members in graph.co_location_groups.values():
        if len(group_members) > 1:
            first = group_members[0]
            for member in group_members[1:]:
                union(first, member)

    # 2. Union mandatory CO_LOCATE edges
    for edge in graph.edges:
        if edge.relationship_type == DependencyType.CO_LOCATE and edge.is_mandatory:
            union(edge.source_workload_id, edge.target_workload_id)

    # Group into sets
    clusters_by_root: dict[str, set[str]] = {}
    for node in parent:
        root = find(node)
        clusters_by_root.setdefault(root, set()).add(node)

    # Only return clusters with 2 or more workloads
    return [c for c in clusters_by_root.values() if len(c) > 1]


def map_workloads_to_co_location_groups(
    graph: Optional[DependencyGraph],
) -> dict[str, tuple[str, list[str]]]:
    """Returns a map: workload_id -> (group_id, sorted_all_member_ids).
    
    Workloads not in any mandatory co-location cluster are omitted from the map.
    """
    clusters = extract_co_location_clusters(graph)
    result: dict[str, tuple[str, list[str]]] = {}

    for idx, cluster in enumerate(sorted(clusters, key=lambda s: sorted(s)[0])):
        members = sorted(list(cluster))
        group_id = f"coloc-group-{idx + 1}-{members[0]}"
        for m in members:
            result[m] = (group_id, members)

    return result
