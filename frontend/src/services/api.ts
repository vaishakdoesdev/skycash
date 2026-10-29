import {
  Workload,
  PrivateDCAssumptions,
  PublicCloudRegion,
  DependencyGraph,
  PlacementRecommendation,
  UtilisationHistory,
  ReviewAlert,
  CostCapacityScenario,
} from '../types';

import defaultWorkloads from '../data/workloads.json';
import defaultDatacenter from '../data/datacenter_assumptions.json';
import defaultRegions from '../data/cloud_regions.json';
import defaultDependencies from '../data/dependencies.json';
import defaultRecommendations from '../data/recommendations.json';
import defaultHistory from '../data/utilisation_history.json';
import defaultAlerts from '../data/review_alerts.json';
import defaultScenarios from '../data/scenarios.json';
import { PlacementDecisionEngine } from './engine';

export type DataSourceMode = 'synthetic_demo' | 'live_api' | 'custom_inventory';

class SkyCashDataService {
  private mode: DataSourceMode = 'synthetic_demo';
  private customWorkloads: Workload[] | null = null;
  private apiAvailable: boolean = false;

  constructor() {
    this.checkApiAvailability();
  }

  async checkApiAvailability(): Promise<boolean> {
    try {
      const res = await fetch('/api/health', { method: 'GET', signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        this.apiAvailable = true;
        return true;
      }
    } catch {
      this.apiAvailable = false;
    }
    return false;
  }

  getMode(): DataSourceMode {
    return this.mode;
  }

  isLiveApi(): boolean {
    return this.apiAvailable;
  }

  setMode(mode: DataSourceMode): void {
    this.mode = mode;
  }

  loadCustomWorkloads(workloads: Workload[]): void {
    this.customWorkloads = workloads;
    this.mode = 'custom_inventory';
  }

  resetToSynthetic(): void {
    this.customWorkloads = null;
    this.mode = 'synthetic_demo';
  }

  async getDatacenterAssumptions(): Promise<PrivateDCAssumptions> {
    if (this.apiAvailable && this.mode === 'live_api') {
      try {
        const res = await fetch('/api/datacenter');
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API fetch failed, falling back to local dataset', err);
      }
    }
    return defaultDatacenter as unknown as PrivateDCAssumptions;
  }

  async getCloudRegions(): Promise<PublicCloudRegion[]> {
    if (this.apiAvailable && this.mode === 'live_api') {
      try {
        const res = await fetch('/api/regions');
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API fetch failed, falling back to local dataset', err);
      }
    }
    return defaultRegions as unknown as PublicCloudRegion[];
  }

  async getWorkloads(): Promise<Workload[]> {
    if (this.mode === 'custom_inventory' && this.customWorkloads) {
      return this.customWorkloads;
    }

    if (this.apiAvailable && this.mode === 'live_api') {
      try {
        const res = await fetch('/api/workloads');
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API fetch failed, falling back to local dataset', err);
      }
    }

    return defaultWorkloads as unknown as Workload[];
  }

  async getDependencyGraph(): Promise<DependencyGraph> {
    if (this.apiAvailable && this.mode === 'live_api') {
      try {
        const res = await fetch('/api/dependencies');
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API fetch failed, falling back to local dataset', err);
      }
    }
    return defaultDependencies as unknown as DependencyGraph;
  }

  async getRecommendations(): Promise<PlacementRecommendation[]> {
    // If using custom workloads, recalculate deterministically with the engine
    if (this.mode === 'custom_inventory' && this.customWorkloads) {
      const dc = await this.getDatacenterAssumptions();
      const regions = await this.getCloudRegions();
      const depGraph = await this.getDependencyGraph();
      return PlacementDecisionEngine.generatePlacementRecommendations(
        this.customWorkloads,
        dc,
        regions,
        depGraph
      );
    }

    if (this.apiAvailable && this.mode === 'live_api') {
      try {
        const res = await fetch('/api/recommendations');
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API fetch failed, falling back to local dataset', err);
      }
    }

    return defaultRecommendations as unknown as PlacementRecommendation[];
  }

  async getUtilisationHistory(): Promise<UtilisationHistory[]> {
    if (this.apiAvailable && this.mode === 'live_api') {
      try {
        const res = await fetch('/api/utilisation');
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API fetch failed, falling back to local dataset', err);
      }
    }
    return defaultHistory as unknown as UtilisationHistory[];
  }

  async getReviewAlerts(): Promise<ReviewAlert[]> {
    if (this.apiAvailable && this.mode === 'live_api') {
      try {
        const res = await fetch('/api/alerts');
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn('API fetch failed, falling back to local dataset', err);
      }
    }
    return defaultAlerts as unknown as ReviewAlert[];
  }

  async getScenarios(): Promise<CostCapacityScenario[]> {
    return defaultScenarios as unknown as CostCapacityScenario[];
  }
}

export const skyCashApi = new SkyCashDataService();
