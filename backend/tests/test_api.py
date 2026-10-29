import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import DataResidencyRequirement, DataSensitivity
from app.models.schemas import Workload
from app.services.data_loader import LoadedData, invalidate_cache, load_all_data

client = TestClient(app)


@pytest.fixture(autouse=True)
def ensure_fresh_cache():
    """Ensure data cache is cleanly loaded for each test."""
    invalidate_cache()
    yield
    invalidate_cache()


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_workloads_all():
    # Test default raw array format (consumed by frontend api.ts)
    response = client.get("/api/workloads")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 6
    assert {w["id"] for w in data} == {
        "wl-core-banking-db",
        "wl-core-banking-api",
        "wl-customer-portal",
        "wl-analytics-reporting",
        "wl-payment-gateway-proxy",
        "wl-dev-sandbox",
    }

    # Test wrapped envelope when requested
    resp_env = client.get("/api/workloads?envelope=true")
    assert resp_env.status_code == 200
    env_data = resp_env.json()
    assert env_data["total"] == 6
    assert env_data["data_source"] == "synthetic"
    assert len(env_data["workloads"]) == 6


def test_list_workloads_filter_environment():
    response = client.get("/api/workloads?environment=production")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    for w in data:
        assert w["environment"].lower() == "production"


def test_list_workloads_filter_sensitivity():
    response = client.get("/api/workloads?sensitivity=RESTRICTED")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    for w in data:
        assert w["data_sensitivity"] == "RESTRICTED"


def test_list_workloads_filter_residency():
    response = client.get("/api/workloads?residency=KARNATAKA_DC_ONLY")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    for w in data:
        assert w["residency_requirement"] == "KARNATAKA_DC_ONLY"


def test_list_workloads_filter_search():
    response = client.get("/api/workloads?search=banking")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any("banking" in w["name"].lower() or "banking" in w["id"].lower() for w in data)


def test_get_workload_detail_found():
    response = client.get("/api/workloads/wl-core-banking-db")
    assert response.status_code == 200
    data = response.json()
    assert data["workload"]["id"] == "wl-core-banking-db"
    assert data["recommendation"] is not None
    assert data["recommendation"]["workload_id"] == "wl-core-banking-db"


def test_get_workload_detail_not_found():
    response = client.get("/api/workloads/nonexistent-id")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_list_recommendations():
    # Test array response default (for frontend compatibility)
    response = client.get("/api/recommendations")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 6
    recs = {r["workload_id"]: r for r in data}
    # Regulatory mandate requires core banking to stay in Karnataka DC
    assert recs["wl-core-banking-db"]["recommended_placement"] == "karnataka-dc-1"

    # Test wrapped envelope when requested
    resp_env = client.get("/api/recommendations?envelope=true")
    assert resp_env.status_code == 200
    env_data = resp_env.json()
    assert env_data["total"] == 6
    assert len(env_data["recommendations"]) == 6


def test_get_recommendation_found():
    response = client.get("/api/recommendations/wl-core-banking-db")
    assert response.status_code == 200
    data = response.json()
    assert data["workload_id"] == "wl-core-banking-db"
    assert data["audit_explanation"] != ""


def test_get_recommendation_not_found():
    response = client.get("/api/recommendations/nonexistent-id")
    assert response.status_code == 404


def test_list_scenarios_report():
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert "current_scenario" in data
    assert "recommended_scenario" in data
    assert "alternative_scenarios" in data
    assert len(data["alternative_scenarios"]) == 2
    assert data["recommended_scenario"]["scenario_id"] == "scenario-recommended"
    assert data["recommended_scenario"]["compliance_violations_count"] == 0


def test_get_scenario_by_id_found():
    response = client.get("/api/scenarios/scenario-recommended")
    assert response.status_code == 200
    data = response.json()
    assert data["scenario_id"] == "scenario-recommended"
    assert data["scenario_name"] == "Recommended Feasible Placement"


def test_get_scenario_by_id_not_found():
    response = client.get("/api/scenarios/scenario-unknown")
    assert response.status_code == 404
    assert "Valid IDs" in response.json()["detail"]


def test_list_utilisation():
    # Test array response default (for frontend compatibility)
    response = client.get("/api/utilisation")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 6

    # Test wrapped envelope when requested
    resp_env = client.get("/api/utilisation?envelope=true")
    assert resp_env.status_code == 200
    env_data = resp_env.json()
    assert env_data["total"] == 6
    assert len(env_data["records"]) == 6


def test_list_utilisation_filter():
    response = client.get("/api/utilisation?workload_id=wl-core-banking-db")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["workload_id"] == "wl-core-banking-db"


def test_list_alerts():
    # Test array response default (for frontend compatibility)
    response = client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for alert in data:
        assert alert["alert_id"]
        assert alert["workload_id"]
        assert alert["severity"] in ["INFO", "WARNING", "CRITICAL"]
        assert alert["trigger_type"]
        assert alert["status"] == "ACTIVE"

    # Test wrapped envelope when requested
    resp_env = client.get("/api/alerts?envelope=true")
    assert resp_env.status_code == 200
    env_data = resp_env.json()
    assert "alerts" in env_data
    assert "total" in env_data
    assert env_data["total"] == len(env_data["alerts"])


def test_get_assumptions():
    response = client.get("/api/assumptions")
    assert response.status_code == 200
    data = response.json()
    assert data["data_source"] == "synthetic"
    assert data["dc_assumptions"]["dc_id"] == "karnataka-dc-1"
    assert len(data["cloud_regions"]) >= 2
    assert len(data["methodology"]) > 0
    assert len(data["limitations"]) > 0


def test_data_loader_caching():
    d1 = load_all_data()
    d2 = load_all_data()
    assert d1 is d2

    invalidate_cache()
    d3 = load_all_data()
    assert d1 is not d3
    assert d3.data_source == "synthetic"


# --------------------------------------------------------------------------
# Placement Strategy Mode Flow Endpoint Tests (GET /api/flow/evaluation)
# --------------------------------------------------------------------------

def test_flow_evaluation_hybrid_default():
    """Successful hybrid evaluation with default query parameters."""
    response = client.get("/api/flow/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "HYBRID"
    assert data["currency"] == "INR"
    assert data["billing_period"] == "MONTHLY"
    assert data["has_feasible_recommendation"] is True
    assert data["recommended_scenario"] is not None
    assert data["recommended_scenario"]["is_feasible"] is True
    assert len(data["evaluated_scenarios"]) == 2
    scenario_ids = [s["scenario_id"] for s in data["evaluated_scenarios"]]
    assert "scenario-local-only" in scenario_ids
    assert "scenario-hybrid" in scenario_ids
    assert len(data["assumptions"]) > 0
    assert "Heuristic Decision Support" in data["limitations_disclaimer"]


def test_flow_evaluation_hybrid_case_insensitive():
    """Case-insensitive query parameter parsing (e.g. 'hybrid')."""
    response = client.get("/api/flow/evaluation?mode=hybrid")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "HYBRID"
    assert data["has_feasible_recommendation"] is True


def test_flow_evaluation_cloud_only_compliance_rejection():
    """Cloud-only evaluation with synthetic dataset: rejected due to Karnataka DC residency."""
    response = client.get("/api/flow/evaluation?mode=CLOUD_ONLY")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "CLOUD_ONLY"
    assert data["has_feasible_recommendation"] is False
    assert data["recommended_scenario"] is None
    assert len(data["evaluated_scenarios"]) == 1
    assert data["evaluated_scenarios"][0]["scenario_id"] == "scenario-cloud-only"
    assert data["evaluated_scenarios"][0]["is_feasible"] is False
    assert data["evaluated_scenarios"][0]["compliance_violations_count"] > 0
    assert "scenario-cloud-only" in data["rejected_scenarios"]
    assert "compliance violation" in data["rejected_scenarios"]["scenario-cloud-only"].lower()
    assert "private_dc_utilization" in data["capacity_analysis"]
    assert "underutilisation" in data["capacity_analysis"]["private_dc_utilization"].lower()


def test_flow_evaluation_cloud_only_case_insensitive():
    """Case-insensitive query parameter parsing for cloud_only."""
    response = client.get("/api/flow/evaluation?mode=cloud_only")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "CLOUD_ONLY"
    assert data["has_feasible_recommendation"] is False


def test_flow_evaluation_invalid_query_param():
    """Invalid query parameter returns HTTP 422 with descriptive error."""
    response = client.get("/api/flow/evaluation?mode=INVALID_MODE")
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert "Invalid strategy mode 'INVALID_MODE'" in data["detail"]
    assert "CLOUD_ONLY" in data["detail"]
    assert "HYBRID" in data["detail"]


def test_flow_evaluation_mock_capacity_overload_and_infeasible(monkeypatch):
    """Simulates an oversized workload that causes capacity overload in local-only and compliance rejection in cloud."""
    base_data = load_all_data()

    # Oversized workload requiring 200 CPU cores (exceeds DC limit of 460) with Restricted sensitivity (cannot move to cloud)
    oversized_workload = Workload(
        id="wl-huge-ledger",
        name="Massive Core Ledger",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=500.0,  # Exceeds usable 460.0 cores
        allocated_ram_gib=4000.0,   # Exceeds usable 3686.0 GiB
        allocated_storage_gib=90000.0, # Exceeds usable 81920.0 GiB
    )

    mocked_loaded = LoadedData(
        workloads=[oversized_workload],
        dependency_graph=base_data.dependency_graph,
        dc_assumptions=base_data.dc_assumptions,
        cloud_regions=base_data.cloud_regions,
        utilisation_history=base_data.utilisation_history,
        data_source="mock-overload",
    )

    monkeypatch.setattr("app.api.routes._load_api_data", lambda: mocked_loaded)

    response = client.get("/api/flow/evaluation?mode=HYBRID")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "HYBRID"
    assert data["has_feasible_recommendation"] is False
    assert data["recommended_scenario"] is None
    assert "local_only_capacity" in data["capacity_analysis"]
    assert "capacity overload" in data["capacity_analysis"]["local_only_capacity"].lower()

    # Both scenarios should be rejected with reasons
    assert "scenario-local-only" in data["rejected_scenarios"]
    assert "capacity overload" in data["rejected_scenarios"]["scenario-local-only"].lower()


# --------------------------------------------------------------------------
# Data and Architecture Endpoints (Required by Frontend)
# --------------------------------------------------------------------------

def test_get_datacenter():
    response = client.get("/api/datacenter")
    assert response.status_code == 200
    data = response.json()
    assert data["dc_id"] == "karnataka-dc-1"
    assert data["total_cpu_cores"] > 0
    assert data["total_ram_gib"] > 0
    assert data["usable_cpu_cores"] <= data["total_cpu_cores"]


def test_get_regions():
    response = client.get("/api/regions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    for r in data:
        assert "region_id" in r
        assert "provider" in r
        assert "compute_rate_per_vcpu_month" in r


def test_get_dependencies():
    response = client.get("/api/dependencies")
    assert response.status_code == 200
    data = response.json()
    assert "co_location_groups" in data
    assert "edges" in data
    assert "nodes" in data


# --------------------------------------------------------------------------
# Auth Endpoints Tests (Required by Frontend authService.ts)
# --------------------------------------------------------------------------

def test_auth_endpoints_flow(tmp_path, monkeypatch):
    test_users_file = tmp_path / "test_auth_users.json"
    monkeypatch.setattr("app.api.auth._USERS_FILE", test_users_file)
    monkeypatch.setattr("app.api.auth._active_sessions", {})
    monkeypatch.setattr("app.api.auth._failed_attempts", {})

    # 1. Config
    resp = client.get("/api/auth/config")
    assert resp.status_code == 200
    assert "google_client_id" in resp.json()
    assert resp.json()["product_name"] == "SkyCash"

    # 2. Unauthenticated me
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401

    # 3. Register a new user
    reg_payload = {
        "email": "testuser@example.com",
        "password": "SecretPassword123!",
        "name": "Test User",
    }
    resp = client.post("/api/auth/register", json=reg_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["email"] == "testuser@example.com"
    token = data["token"]
    assert token

    # Register duplicate email -> 400
    resp = client.post("/api/auth/register", json=reg_payload)
    assert resp.status_code == 400

    # 4. Authenticated me with Bearer token
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "testuser@example.com"

    # 5. Logout
    resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

    # 6. Me after logout -> 401
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401

    # 7. Login with wrong password -> 401
    resp = client.post("/api/auth/login", json={"email": "testuser@example.com", "password": "WrongPassword"})
    assert resp.status_code == 401

    # 8. Login with correct password -> 200
    resp = client.post("/api/auth/login", json={"email": "testuser@example.com", "password": "SecretPassword123!"})
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "testuser@example.com"

    # 9. Forgot password
    resp = client.post("/api/auth/forgot-password", json={"email": "testuser@example.com"})
    assert resp.status_code == 200
    assert "guidance" in resp.json()["message"].lower()

    # 10. Lockout after 5 failed logins
    for _ in range(5):
        resp = client.post("/api/auth/login", json={"email": "testuser@example.com", "password": "WrongPassword"})
        assert resp.status_code == 401
    # Next attempt triggers lockout
    resp = client.post("/api/auth/login", json={"email": "testuser@example.com", "password": "WrongPassword"})
    assert resp.status_code == 429
    assert "too many failed" in resp.json()["detail"].lower()


def test_auth_google_flow(tmp_path, monkeypatch):
    import base64
    import json

    test_users_file = tmp_path / "test_auth_google_users.json"
    monkeypatch.setattr("app.api.auth._USERS_FILE", test_users_file)
    monkeypatch.setattr("app.api.auth._active_sessions", {})

    # 1. When Google Client ID is unconfigured -> 501
    monkeypatch.setattr("app.api.auth._get_google_client_id", lambda: None)
    resp = client.post("/api/auth/google", json={"credential": "mock-token"})
    assert resp.status_code == 501
    assert "GOOGLE_OAUTH_NOT_CONFIGURED" in resp.json()["detail"]["code"]

    # 2. When Google Client ID is configured
    client_id = "test-client-id-12345.apps.googleusercontent.com"
    monkeypatch.setattr("app.api.auth._get_google_client_id", lambda: client_id)

    # Missing credential -> 400
    resp = client.post("/api/auth/google", json={"credential": "   "})
    assert resp.status_code == 400

    # Build a synthetic signed JWT (header.payload.signature)
    header = base64.urlsafe_b64encode(b'{"alg":"RS256","typ":"JWT"}').decode().rstrip("=")
    payload_data = {
        "email": "developer@googleuser.com",
        "name": "Jane Developer",
        "aud": client_id,
        "iss": "https://accounts.google.com",
    }
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
    fake_jwt = f"{header}.{payload}.fake_signature"

    resp = client.post("/api/auth/google", json={"credential": fake_jwt})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "developer@googleuser.com"
    assert data["user"]["name"] == "Jane Developer"
    assert data["user"]["auth_provider"] == "google"
    token = data["token"]
    assert token

    # Validate session via /api/auth/me
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["user"]["email"] == "developer@googleuser.com"


