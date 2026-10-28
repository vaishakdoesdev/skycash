from typing import Optional
from app.models.schemas import PrivateDCAssumptions, Workload


def check_dc_capacity_fit(
    dc: PrivateDCAssumptions,
    cpu_demand: float,
    ram_demand: float,
    storage_demand: float,
    existing_allocated_cpu: float = 0.0,
    existing_allocated_ram: float = 0.0,
    existing_allocated_storage: float = 0.0,
) -> tuple[bool, Optional[str]]:
    """Checks whether the aggregate workload resource demand fits within usable Private DC capacity.
    
    Returns (True, None) if capacity is sufficient, or (False, reason) if headroom is breached.
    """
    total_cpu = cpu_demand + existing_allocated_cpu
    if total_cpu > dc.usable_cpu_cores:
        return (
            False,
            f"Private DC usable CPU capacity breached: requested {total_cpu:.1f} cores exceeds usable limit of {dc.usable_cpu_cores:.1f} cores.",
        )

    total_ram = ram_demand + existing_allocated_ram
    if total_ram > dc.usable_ram_gib:
        return (
            False,
            f"Private DC usable RAM capacity breached: requested {total_ram:.1f} GiB exceeds usable limit of {dc.usable_ram_gib:.1f} GiB.",
        )

    total_storage = storage_demand + existing_allocated_storage
    if total_storage > dc.usable_storage_gib:
        return (
            False,
            f"Private DC usable persistent storage capacity breached: requested {total_storage:.1f} GiB exceeds usable limit of {dc.usable_storage_gib:.1f} GiB.",
        )

    return (True, None)
