import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Workload,
  PlacementRecommendation,
  PrivateDCAssumptions,
  PublicCloudRegion,
  DependencyGraph,
  UtilisationHistory,
  ReviewAlert,
  CostCapacityScenario,
  ServerConfigurationState,
} from './types';
import { skyCashApi, DataSourceMode } from './services/api';
import { PlacementDecisionEngine } from './services/engine';
import { CapacityEngine } from './services/capacityEngine';
import { validateConfiguration } from './services/configurationValidator';
import { InfrastructureSelector } from './components/InfrastructureSelector';
import { ServerConfigurationScreen } from './components/ServerConfigurationScreen';
import { AnalysisScreen } from './components/AnalysisScreen';
import { WorkloadInventoryScreen } from './components/WorkloadInventoryScreen';
import { TestingAndComparisonScreen } from './components/TestingAndComparisonScreen';
import { SkyCashVerdictScreen } from './components/SkyCashVerdictScreen';
import { Navbar } from './components/Navbar';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { WorkloadInventory } from './components/WorkloadInventory';
import { WorkloadDetailModal } from './components/WorkloadDetailModal';
import { DependencyGraphView } from './components/DependencyGraphView';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { ReviewAlertsView } from './components/ReviewAlertsView';
import { MethodologyView } from './components/MethodologyView';
import { InventoryUploader } from './components/InventoryUploader';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginGateway } from './components/auth/LoginGateway';
import { UserStatusPill } from './components/auth/UserStatusPill';
import './style.css';

function AppContent() {
  const { isAuthenticated, isAuthChecking } = useAuth();

  // Navigation Flow State:
  // 'selection' (Step 1: 3D Choice)
  // -> 'configuration' (Step 2: Server Config)
  // -> 'analysis' (Step 3: 3D Capacity Assessment & Recommendation)
  // -> 'testing' (Step 4: Testing & Comparison)
  // -> 'verdict' (Step 5: SkyCash Final Verdict)
  // Auxiliary: 'inventory' (Workload Inventory) | 'dashboard' (Estate Audit)
  const [currentScreen, setCurrentScreen] = useState<
    'selection' | 'configuration' | 'analysis' | 'testing' | 'verdict' | 'inventory' | 'dashboard' | 'trends'
  >('selection');

  const [selectedSetup, setSelectedSetup] = useState<'hired' | 'hybrid'>('hybrid');
  const [serverConfig, setServerConfig] = useState<ServerConfigurationState>({});

  // Step 4 & 5 Testing state
  const [hasTestedComparison, setHasTestedComparison] = useState<boolean>(false);
  const [testScenarioConfig, setTestScenarioConfig] = useState<ServerConfigurationState | null>(null);

  // Evaluation Sub-tabs for Dashboard
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [recommendations, setRecommendations] = useState<PlacementRecommendation[]>([]);
  const [dc, setDc] = useState<PrivateDCAssumptions | null>(null);
  const [regions, setRegions] = useState<PublicCloudRegion[]>([]);
  const [depGraph, setDepGraph] = useState<DependencyGraph | null>(null);
  const [utilisationHistory, setUtilisationHistory] = useState<UtilisationHistory[]>([]);
  const [alerts, setAlerts] = useState<ReviewAlert[]>([]);
  const [scenarios, setScenarios] = useState<CostCapacityScenario[]>([]);

  const [selectedWorkload, setSelectedWorkload] = useState<Workload | null>(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState<boolean>(false);
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>('synthetic_demo');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load all data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        fetchedWorkloads,
        fetchedDc,
        fetchedRegions,
        fetchedDepGraph,
        fetchedRecs,
        fetchedHistory,
        fetchedAlerts,
        fetchedScenarios,
      ] = await Promise.all([
        skyCashApi.getWorkloads(),
        skyCashApi.getDatacenterAssumptions(),
        skyCashApi.getCloudRegions(),
        skyCashApi.getDependencyGraph(),
        skyCashApi.getRecommendations(),
        skyCashApi.getUtilisationHistory(),
        skyCashApi.getReviewAlerts(),
        skyCashApi.getScenarios(),
      ]);

      setWorkloads(fetchedWorkloads);
      setDc(fetchedDc);
      setRegions(fetchedRegions);
      setDepGraph(fetchedDepGraph);
      setRecommendations(fetchedRecs);
      setUtilisationHistory(fetchedHistory);
      setAlerts(fetchedAlerts);
      setScenarios(fetchedScenarios);
      setDataSourceMode(skyCashApi.getMode());
    } catch (err) {
      console.error('Failed to load Sky Cash dataset:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // Compute estate summary
  const overview = useMemo(() => {
    if (!dc) return null;
    return PlacementDecisionEngine.computeEstateOverview(workloads, recommendations, dc);
  }, [workloads, recommendations, dc]);

  // Real-time deterministic capacity analysis result
  const capacityResult = useMemo(() => {
    return CapacityEngine.evaluate(selectedSetup, serverConfig);
  }, [selectedSetup, serverConfig]);

  // Real-time configuration validation result
  const validation = useMemo(() => {
    return validateConfiguration(selectedSetup, serverConfig);
  }, [selectedSetup, serverConfig]);

  // Dynamic calculation of max unlocked step in progress indicator
  const maxUnlockedStep = useMemo(() => {
    if (!validation.isValid) {
      return 2;
    }
    if (!hasTestedComparison) {
      return 4;
    }
    return 5;
  }, [validation.isValid, hasTestedComparison]);

  // Unified 5-Step Navigation Handler
  const handleNavigateStep = (stepNumber: number) => {
    if (stepNumber === 1) {
      setCurrentScreen('selection');
    } else if (stepNumber === 2) {
      setCurrentScreen('configuration');
    } else if (stepNumber === 3) {
      if (validation.isValid) {
        setCurrentScreen('analysis');
      }
    } else if (stepNumber === 4) {
      if (validation.isValid) {
        setHasTestedComparison(true);
        setCurrentScreen('testing');
      }
    } else if (stepNumber === 5) {
      if (validation.isValid && hasTestedComparison) {
        setCurrentScreen('verdict');
      }
    }
  };

  // Transition: Step 1 -> Step 2
  const handleSetupContinue = (choice: 'hired' | 'hybrid') => {
    setSelectedSetup(choice);
    setCurrentScreen('configuration');
  };

  // Transition: Step 2 -> Step 3
  const handleAnalyzeConfiguration = (config: ServerConfigurationState) => {
    setHasTestedComparison(false);
    setTestScenarioConfig(null);
    setServerConfig(config);
    setCurrentScreen('analysis');
  };

  // Load illustrative demo data explicitly
  const handleLoadDemoData = () => {
    if (selectedSetup === 'hybrid') {
      const demoConfig: ServerConfigurationState = {
        localCpuCores: 64,
        localRamGb: 256,
        localCapacityUtilPct: 68,
        localOperatingCostMonthly: 42000,
        rentedServerCount: 2,
        cpuCoresPerServer: 16,
        ramGbPerServer: 64,
        monthlyRentalCostPerServer: 14500,
        avgCpuUtilizationPct: 55,
        avgRamUtilizationPct: 60,
        workloadDemandCpu: 80,
        workloadDemandRam: 320,
        residencyConstraint: 'KARNATAKA_DC_ONLY',
        coLocationRequirement: true,
        workloadNotes: 'Illustrative hybrid configuration with Karnataka DC localization.',
      };
      setServerConfig(demoConfig);
    } else {
      const demoConfig: ServerConfigurationState = {
        rentedServerCount: 4,
        cpuCoresPerServer: 16,
        ramGbPerServer: 64,
        monthlyRentalCostPerServer: 16000,
        avgCpuUtilizationPct: 72,
        avgRamUtilizationPct: 68,
        workloadDemandCpu: 48,
        workloadDemandRam: 192,
      };
      setServerConfig(demoConfig);
    }
    setHasTestedComparison(true);
  };

  // Transition: Step 4 -> Step 5
  const handleProceedToVerdict = (testConfig: ServerConfigurationState) => {
    setTestScenarioConfig(testConfig);
    setHasTestedComparison(true);
    setCurrentScreen('verdict');
  };

  // Deliberate reset: Start New Assessment
  const handleStartNewAssessment = () => {
    setServerConfig({});
    setTestScenarioConfig(null);
    setHasTestedComparison(false);
    setCurrentScreen('selection');
  };

  // Custom workload inventory upload
  const handleLoadCustomInventory = (customList: Workload[]) => {
    skyCashApi.loadCustomWorkloads(customList);
    loadData();
    setCurrentScreen('inventory');
  };

  // Reset to synthetic demo
  const handleResetData = () => {
    skyCashApi.resetToSynthetic();
    loadData();
  };

  const selectedRecommendation = selectedWorkload
    ? recommendations.find((r) => r.workload_id === selectedWorkload.id) || null
    : null;

  // 1. Loading Authentication State
  if (isAuthChecking) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div className="loading-title">Verifying BUTANE Credentials...</div>
        <div className="loading-subtitle">
          Connecting to SkyCash sovereign authentication gateway
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: Render BUTANE 3D Login Gateway
  if (!isAuthenticated) {
    return (
      <LoginGateway
        onLoginSuccess={() => {
          setCurrentScreen('selection');
        }}
      />
    );
  }

  // 3. Authenticated: Loading Data State
  if (isLoading || !dc || !depGraph || !overview) {
    return (
      <div className="loading-screen">
        <UserStatusPill />
        <div className="loading-spinner"></div>
        <div className="loading-title">Initializing SkyCash 3D Engine...</div>
        <div className="loading-subtitle">
          Constructing WebGL infrastructure models & sovereign catalog
        </div>
      </div>
    );
  }

  // Helper to wrap screens with UserStatusPill and InventoryUploader modal
  const renderScreenWithUploader = (content: React.ReactNode) => (
    <>
      <UserStatusPill onOpenUploader={() => setIsUploaderOpen(true)} />
      {content}
      {isUploaderOpen && (
        <InventoryUploader
          onLoadCustom={handleLoadCustomInventory}
          onClose={() => setIsUploaderOpen(false)}
        />
      )}
    </>
  );

  // STEP 1: 3D Infrastructure Setup Selector (Option A vs Option B)
  if (currentScreen === 'selection') {
    return renderScreenWithUploader(
      <InfrastructureSelector
        onSelectSetup={handleSetupContinue}
        initialChoice={selectedSetup}
        maxUnlockedStep={maxUnlockedStep}
        onNavigateStep={handleNavigateStep}
      />
    );
  }

  // STEP 2: Server & Telemetry Configuration Screen
  if (currentScreen === 'configuration') {
    return renderScreenWithUploader(
      <ServerConfigurationScreen
        selectedSetup={selectedSetup}
        initialConfig={serverConfig}
        onBackToSetup={() => setCurrentScreen('selection')}
        onAnalyze={handleAnalyzeConfiguration}
        maxUnlockedStep={maxUnlockedStep}
        onNavigateStep={handleNavigateStep}
      />
    );
  }

  // STEP 3: 3D Capacity Analysis & Recommendation Screen
  if (currentScreen === 'analysis') {
    return renderScreenWithUploader(
      <AnalysisScreen
        result={capacityResult}
        config={serverConfig}
        onBackToConfig={() => setCurrentScreen('configuration')}
        onBackToSetup={() => setCurrentScreen('selection')}
        onExploreCatalog={() => setCurrentScreen('inventory')}
        onNavigateToTrends={() => {
          setHasTestedComparison(true);
          setCurrentScreen('testing');
        }}
        maxUnlockedStep={maxUnlockedStep}
        onNavigateStep={handleNavigateStep}
      />
    );
  }

  // STEP 4: Testing & Comparison Screen
  if (currentScreen === 'testing' || currentScreen === 'trends') {
    return renderScreenWithUploader(
      <TestingAndComparisonScreen
        baselineConfig={serverConfig}
        baselineResult={capacityResult}
        selectedSetup={selectedSetup}
        maxUnlockedStep={maxUnlockedStep}
        onNavigateStep={handleNavigateStep}
        onBackToAnalysis={() => setCurrentScreen('analysis')}
        onBackToConfig={() => setCurrentScreen('configuration')}
        onProceedToVerdict={handleProceedToVerdict}
        onLoadDemoData={handleLoadDemoData}
        onNavigateToInventory={() => setCurrentScreen('inventory')}
      />
    );
  }

  // STEP 5: SkyCash Final Verdict Screen
  if (currentScreen === 'verdict') {
    return renderScreenWithUploader(
      <SkyCashVerdictScreen
        baselineConfig={serverConfig}
        baselineResult={capacityResult}
        testScenarioConfig={testScenarioConfig}
        selectedSetup={selectedSetup}
        maxUnlockedStep={maxUnlockedStep}
        hasTestedComparison={hasTestedComparison}
        onNavigateStep={handleNavigateStep}
        onBackToTesting={() => setCurrentScreen('testing')}
        onBackToConfig={() => setCurrentScreen('configuration')}
        onStartNewAssessment={handleStartNewAssessment}
        onLoadDemoData={handleLoadDemoData}
      />
    );
  }

  // Dedicated Clean Workload Inventory Screen
  if (currentScreen === 'inventory') {
    return renderScreenWithUploader(
      <WorkloadInventoryScreen
        workloads={workloads}
        recommendations={recommendations}
        depGraph={depGraph}
        onBackToAnalysis={() => setCurrentScreen('analysis')}
        onNavigateToTrends={() => {
          setHasTestedComparison(true);
          setCurrentScreen('testing');
        }}
        onLoadDemoData={handleResetData}
        onOpenUploader={() => setIsUploaderOpen(true)}
      />
    );
  }

  // Optional Legacy Estate Audit Catalog
  return (
    <div className="app-layout">
      <UserStatusPill />
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        dataSourceMode={dataSourceMode}
        onResetData={handleResetData}
        onOpenUploader={() => setIsUploaderOpen(true)}
        alertCount={alerts.filter((a) => a.status === 'ACTIVE').length}
        selectedSetup={selectedSetup}
        onBackToSetup={() => setCurrentScreen('selection')}
        onBackToConfig={() => setCurrentScreen('configuration')}
      />

      <div className="analysis-context-banner">
        <div className="context-banner-content">
          <div className="context-banner-left">
            <span className="stepper-stage-tag">Decision Support Inventory & Simulation Catalog</span>
            <span className="context-desc">
              Detailed placement analysis for{' '}
              <strong>
                {selectedSetup === 'hybrid'
                  ? 'Option B: Local + Hired Server (Hybrid Setup)'
                  : 'Option A: Hired Server (Cloud Setup)'}
              </strong>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setCurrentScreen('analysis')}
            >
              ← Return to 3D Capacity Analysis
            </button>
          </div>
        </div>
      </div>

      <main className="main-content">
        {currentTab === 'overview' && (
          <ExecutiveDashboard
            overview={overview}
            recommendations={recommendations}
            workloads={workloads}
            onSelectWorkload={setSelectedWorkload}
            onNavigateToInventory={() => setCurrentTab('inventory')}
          />
        )}

        {currentTab === 'inventory' && (
          <WorkloadInventory
            workloads={workloads}
            recommendations={recommendations}
            onSelectWorkload={setSelectedWorkload}
          />
        )}

        {currentTab === 'dependencies' && (
          <DependencyGraphView
            depGraph={depGraph}
            workloads={workloads}
            recommendations={recommendations}
            onSelectWorkload={setSelectedWorkload}
          />
        )}

        {currentTab === 'simulator' && (
          <ScenarioSimulator
            dc={dc}
            recommendations={recommendations}
            scenarios={scenarios}
          />
        )}

        {currentTab === 'alerts' && (
          <ReviewAlertsView
            alerts={alerts}
            workloads={workloads}
            onSelectWorkload={setSelectedWorkload}
          />
        )}

        {currentTab === 'methodology' && (
          <MethodologyView
            dc={dc}
            regions={regions}
          />
        )}
      </main>

      {selectedWorkload && (
        <WorkloadDetailModal
          workload={selectedWorkload}
          recommendation={selectedRecommendation}
          dc={dc}
          regions={regions}
          depGraph={depGraph}
          allWorkloads={workloads}
          utilisationHistory={utilisationHistory}
          onClose={() => setSelectedWorkload(null)}
        />
      )}

      {isUploaderOpen && (
        <InventoryUploader
          onLoadCustom={handleLoadCustomInventory}
          onClose={() => setIsUploaderOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
