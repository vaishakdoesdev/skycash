import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_loader import invalidate_cache, load_all_data

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


def test_list_workloads_all():
    response = client.get("/api/workloads")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 6
    assert data["data_source"] == "synthetic"
    assert len(data["workloads"]) == 6
    assert {w["id"] for w in data["workloads"]} == {
        "wl-core-banking-db",
        "wl-core-banking-api",
        "wl-customer-portal",
        "wl-analytics-reporting",
        "wl-payment-gateway-proxy",
        "wl-dev-sandbox",
    }


def test_list_workloads_filter_environment():
    response = client.get("/api/workloads?environment=production")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for w in data["workloads"]:
        assert w["environment"].lower() == "production"


def test_list_workloads_filter_sensitivity():
    response = client.get("/api/workloads?sensitivity=RESTRICTED")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for w in data["workloads"]:
        assert w["data_sensitivity"] == "RESTRICTED"


def test_list_workloads_filter_residency():
    response = client.get("/api/workloads?residency=KARNATAKA_DC_ONLY")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for w in data["workloads"]:
        assert w["residency_requirement"] == "KARNATAKA_DC_ONLY"


def test_list_workloads_filter_search():
    response = client.get("/api/workloads?search=banking")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("banking" in w["name"].lower() or "banking" in w["id"].lower() for w in data["workloads"])


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
    response = client.get("/api/recommendations")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 6
    assert len(data["recommendations"]) == 6
    recs = {r["workload_id"]: r for r in data["recommendations"]}
    # Regulatory mandate requires core banking to stay in Karnataka DC
    assert recs["wl-core-banking-db"]["recommended_placement"] == "karnataka-dc-1"


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
    response = client.get("/api/utilisation")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 6
    assert len(data["records"]) == 6


def test_list_utilisation_filter():
    response = client.get("/api/utilisation?workload_id=wl-core-banking-db")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["records"][0]["workload_id"] == "wl-core-banking-db"


def test_list_alerts():
    response = client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    assert "total" in data
    assert data["total"] == len(data["alerts"])
    for alert in data["alerts"]:
        assert alert["alert_id"]
        assert alert["workload_id"]
        assert alert["severity"] in ["INFO", "WARNING", "CRITICAL"]
        assert alert["trigger_type"]
        assert alert["status"] == "ACTIVE"


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
