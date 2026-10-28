from typing import Optional
from app.models.schemas import PrivateDCAssumptions, PublicCloudRegion, Workload


def calculate_private_dc_workload_cost(
    workload: Workload,
    dc: PrivateDCAssumptions,
) -> float:
    """Calculates fully burdened monthly run cost in the Karnataka Private Data Centre.
    
    Formula:
      raw_compute = allocated_cpu_cores * amortized_cost_per_cpu_core_month
      raw_ram     = allocated_ram_gib * amortized_cost_per_ram_gib_month
      raw_storage = allocated_storage_gib * amortized_cost_per_storage_gib_month
      subtotal    = raw_compute + raw_ram + raw_storage
      pue_overhead = subtotal * (power_cooling_pue_overhead_pct / 100.0)
      total_monthly_cost = subtotal + pue_overhead
    """
    raw_compute = workload.allocated_cpu_cores * dc.amortized_cost_per_cpu_core_month
    raw_ram = workload.allocated_ram_gib * dc.amortized_cost_per_ram_gib_month
    raw_storage = workload.allocated_storage_gib * dc.amortized_cost_per_storage_gib_month
    subtotal = raw_compute + raw_ram + raw_storage
    pue_multiplier = 1.0 + (dc.power_cooling_pue_overhead_pct / 100.0)
    return round(subtotal * pue_multiplier, 2)


def calculate_cloud_workload_cost(
    workload: Workload,
    region: PublicCloudRegion,
    monthly_egress_gib: Optional[float] = None,
) -> float:
    """Calculates pay-as-you-go monthly run cost in an approved public cloud region.
    
    Formula:
      compute = allocated_cpu_cores * compute_rate_per_vcpu_month
      memory  = allocated_ram_gib * memory_rate_per_gib_month
      storage = allocated_storage_gib * storage_ssd_rate_per_gib_month
      egress  = monthly_egress_gib * egress_rate_per_gib
      total_monthly_cost = compute + memory + storage + egress
    """
    compute = workload.allocated_cpu_cores * region.compute_rate_per_vcpu_month
    memory = workload.allocated_ram_gib * region.memory_rate_per_gib_month
    storage = workload.allocated_storage_gib * region.storage_ssd_rate_per_gib_month
    egress = (monthly_egress_gib or 0.0) * region.egress_rate_per_gib
    return round(compute + memory + storage + egress, 2)
