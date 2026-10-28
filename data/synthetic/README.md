# Synthetic Demonstration Dataset

This directory contains deterministic, clearly labelled synthetic data for demonstrating and validating **Sky Cash** (CC-03).

## Scope and Intent

The datasets herein are **100% synthetic mock records** representing an enterprise infrastructure operating a private on-premise data centre in Bengaluru (Karnataka, India) alongside approved public cloud regions in India (AWS Mumbai `ap-south-1` and Azure Central India `azure-central-india`).

No actual confidential customer data or production inventory is included in this repository.

## Files

- [`workloads.json`](file:///D:/skycash/data/synthetic/workloads.json): Synthetic workload inventory illustrating distinct data sensitivity classifications, residency boundaries, resource sizes, and soft preferences.
- [`dependencies.json`](file:///D:/skycash/data/synthetic/dependencies.json): Explicit directed graph of workload dependencies, including a mandatory co-location group (`group-core-banking`) between the database and transaction API.
- [`datacenter_assumptions.json`](file:///D:/skycash/data/synthetic/datacenter_assumptions.json): Fully burdened capacity and cost assumptions for the Karnataka private data centre in INR per month.
- [`cloud_regions.json`](file:///D:/skycash/data/synthetic/cloud_regions.json): Approved and restricted public cloud regions with explicit pricing rates (INR/vCPU-month, INR/GiB RAM-month, INR/GiB SSD-month, INR/GiB egress).
- [`utilisation_history.json`](file:///D:/skycash/data/synthetic/utilisation_history.json): Historical monthly telemetry points indicating average and peak CPU %, memory %, disk GiB, and egress bandwidth.

## Standard Units & Semantics

| Metric | Unit | Standard Representation |
| :--- | :--- | :--- |
| Compute Allocation | vCPU / Core | Floating point number (e.g. `32.0`) |
| Memory Allocation | GiB | Binary gigabytes (1 GiB = 1024 MiB) |
| Persistent Storage | GiB | Binary gigabytes (e.g. `8192.0` GiB) |
| Currency | ISO 4217 Code | `"INR"` (Indian Rupee) |
| Billing Interval | Period | `"MONTHLY"` (720-hour basis) |
| Network Latency | Milliseconds (ms) | Floating point threshold (e.g. `2.0` ms) |
| Network Egress | GiB | Outbound network data in GiB |
