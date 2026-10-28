# Decision Engine

The deterministic placement engine belongs here, separate from FastAPI and the frontend. No placement rules or calculations are implemented yet.

Before implementation, confirm the local inventory schema and record units and assumptions. Apply residency and sensitivity eligibility rules before comparing cost, capacity, and performance-related criteria. Respect dependency/co-location requirements from the confirmed model. Keep outputs explainable and never execute migrations.
