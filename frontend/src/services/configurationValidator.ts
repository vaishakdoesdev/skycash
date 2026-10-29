import { ServerConfigurationState } from '../types';

export interface ValidationResult {
  isValid: boolean;
  isDemo: boolean;
  missingFields: string[];
  providedFields: string[];
  totalRequired: number;
}

/**
 * Validates whether the supplied server configuration contains the required
 * fields to compute capacity and cost metrics without fabricating values.
 */
export function validateConfiguration(
  setup: 'hired' | 'hybrid',
  config: ServerConfigurationState
): ValidationResult {
  const isHybrid = setup === 'hybrid';
  const missingFields: string[] = [];
  const providedFields: string[] = [];

  // Helper check for positive number
  const checkPositive = (
    val: number | string | undefined,
    fieldName: string,
    isUnknownFlag?: boolean
  ) => {
    if (isUnknownFlag) {
      providedFields.push(`${fieldName} (Marked Unknown)`);
      return;
    }
    if (val !== undefined && val !== '' && !isNaN(Number(val)) && Number(val) > 0) {
      providedFields.push(fieldName);
    } else {
      missingFields.push(fieldName);
    }
  };

  // Helper check for percentage (0 - 100)
  const checkPercentage = (
    val: number | string | undefined,
    fieldName: string,
    isUnknownFlag?: boolean
  ) => {
    if (isUnknownFlag) {
      providedFields.push(`${fieldName} (Marked Unknown)`);
      return;
    }
    if (
      val !== undefined &&
      val !== '' &&
      !isNaN(Number(val)) &&
      Number(val) >= 0 &&
      Number(val) <= 100
    ) {
      providedFields.push(fieldName);
    } else {
      missingFields.push(fieldName);
    }
  };

  // Helper check for non-negative number (>= 0)
  const checkNonNegative = (
    val: number | string | undefined,
    fieldName: string,
    isUnknownFlag?: boolean
  ) => {
    if (isUnknownFlag) {
      providedFields.push(`${fieldName} (Marked Unknown)`);
      return;
    }
    if (val !== undefined && val !== '' && !isNaN(Number(val)) && Number(val) >= 0) {
      providedFields.push(fieldName);
    } else {
      missingFields.push(fieldName);
    }
  };

  // 1. Shared Hired / Cloud Server Requirements
  checkPositive(config.rentedServerCount, 'Number of Rented Servers');
  checkPositive(config.cpuCoresPerServer, 'CPU Cores per Rented Server');
  checkPositive(config.ramGbPerServer, 'RAM per Rented Server (GB)');

  checkNonNegative(
    config.monthlyRentalCostPerServer,
    'Monthly Rental Cost per Server (₹)',
    config.rentalCostUnknown
  );

  checkPercentage(
    config.avgCpuUtilizationPct,
    'Average CPU Utilization (%)',
    config.cpuUtilizationUnknown
  );

  checkPercentage(
    config.avgRamUtilizationPct,
    'Average RAM Utilization (%)',
    config.ramUtilizationUnknown
  );

  // 2. Hybrid Specific Requirements
  if (isHybrid) {
    checkPositive(config.localCpuCores, 'Local Server CPU Cores');
    checkPositive(config.localRamGb, 'Local Server RAM (GB)');
    checkPercentage(
      config.localCapacityUtilPct,
      'Local Server Capacity Utilization (%)',
      config.localUtilizationUnknown
    );
    checkNonNegative(
      config.localOperatingCostMonthly,
      'Local Operating Cost Monthly (₹)',
      config.localCostUnknown
    );
  }

  const isDemo = isDemoConfiguration(setup, config);
  const isValid = missingFields.length === 0;

  return {
    isValid,
    isDemo,
    missingFields,
    providedFields,
    totalRequired: missingFields.length + providedFields.length,
  };
}

/**
 * Checks if a configuration strictly matches the standard illustrative demo dataset.
 */
export function isDemoConfiguration(
  setup: 'hired' | 'hybrid',
  config: ServerConfigurationState
): boolean {
  if (setup === 'hybrid') {
    return (
      Number(config.localCpuCores) === 64 &&
      Number(config.localRamGb) === 256 &&
      Number(config.rentedServerCount) === 2 &&
      Number(config.cpuCoresPerServer) === 16 &&
      Number(config.monthlyRentalCostPerServer) === 14500
    );
  }
  return (
    Number(config.rentedServerCount) === 4 &&
    Number(config.cpuCoresPerServer) === 16 &&
    Number(config.monthlyRentalCostPerServer) === 16000
  );
}
