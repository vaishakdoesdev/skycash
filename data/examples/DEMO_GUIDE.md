# SkyCash Demo Guide & Presentation Walkthrough

This guide provides ready-to-use demonstration storylines, mock datasets, and step-by-step walkthrough instructions for presenting **SkyCash** during hackathon pitches, technical evaluations, and stakeholder demos.

---

## 🎯 The 30-Second Elevator Pitch
> *"Enterprises struggle to balance cloud cost savings with data privacy and regulatory compliance. **SkyCash** is an intelligent, deterministic decision-support engine that analyzes enterprise workloads and answers: **Which workload belongs where?** It guarantees that strict regulatory mandates (RBI, MeitY, ISO 27001) are never compromised, prevents data center capacity crashes, and maximizes monthly cost savings—all without sending confidential customer data to third-party AI or cloud providers."*

---

## 📁 Pre-Configured Demo Datasets (Located in `data/examples/`)

| File | Scenario Name | Best For Demonstrating | Key Takeaway for Judges |
| :--- | :--- | :--- | :--- |
| **`01_fintech_enterprise_hybrid.json`** | **Fintech Cost & Compliance Optimization** | Cloud repatriation, compliance enforcement, and direct cost savings | Recommends moving a misplaced KYC database back to Karnataka DC to eliminate an RBI violation while saving **₹46,359/month** (9.6% net savings). |
| **`02_festive_peak_capacity_overload.json`** | **Festive Peak Capacity Overload** | Usable DC capacity protection, CPU/RAM headroom calculations | Detects that festive scaling requires 580 cores against a 460-core limit (120-core deficit), preventing on-premise hardware failure. |
| **`03_cross_cloud_microservices_mesh.json`** | **Microservices Mesh & Co-location** | Graph clustering, latency protection, HSM root-of-trust | Enforces mandatory co-location between OAuth gateway and Key Vault, ensuring sub-2ms cryptographic key exchange. |

---

## 🚀 How to Load Mock Datasets in the Live UI

1. Open the application in your browser: **`http://localhost:5173`**
2. In the top navigation bar, click the **"Load Inventory"** button (top right).
3. In the modal that opens, either:
   - **Click the dropzone** and select one of the JSON files from `D:\skycash\data\examples\`, **OR**
   - Open any `.json` file in a text editor, copy all text, and paste it into the JSON text box.
4. Click **"Load & Evaluate Inventory"**.
5. The UI badge will immediately switch to **`Custom Inventory`** and all 3D server racks, charts, and recommendations will update in real time.
6. Click **"Reset Demo"** in the top bar at any time to return to the clean baseline.

---

## 🎬 Recommended 3-Minute Presentation Script

### Act 1: The Problem & Live Baseline (45 seconds)
1. **Show the Login Screen**:
   - Highlight the sovereign security features: Email + Password authentication with rate-limiting lockout, plus Google OAuth single sign-on.
   - Point out that all authentication and session management is 100% local (`data/auth_users.json`).
2. **Enter the Workspace**:
   - Show the 3D server rack visualization (local Karnataka DC chassis vs cloud cluster).
   - Point to the Navbar badge: **`Live FastAPI`** confirming active end-to-end communication with the Python decision engine.

### Act 2: Loading Scenario 1 — "The Compliance Audit" (90 seconds)
1. Click **"Load Inventory"** and upload [`01_fintech_enterprise_hybrid.json`](file:///D:/skycash/data/examples/01_fintech_enterprise_hybrid.json).
2. Go to **Workload Inventory**:
   - Highlight `wl-customer-kyc-db` (Customer KYC & Aadhaar Vault).
   - Show the judges: *"In the baseline, this workload was mistakenly hosted on public cloud (`aws-ap-south-1`). Because it contains `RESTRICTED` biometric/financial data, corporate policy and RBI localization require it to stay inside our Karnataka DC."*
   - Show SkyCash's verdict: **`CHANGE_RECOMMENDED`** with recommendation to repatriate to `karnataka-dc-1`.
   - Highlight the financial win: *"Repatriating this workload doesn't just fix a compliance breach—it also saves **₹26,077 per month** because on-premise infrastructure is already amortized."*
3. Show the **Executive Dashboard**:
   - Point out the total monthly cost dropping from **₹483,648.56** to **₹437,288.70** (**₹46,359.86 net monthly savings**).

### Act 3: Testing Scenario 2 — "Festive Season Capacity Guardrails" (45 seconds)
1. Click **"Load Inventory"** and upload [`02_festive_peak_capacity_overload.json`](file:///D:/skycash/data/examples/02_festive_peak_capacity_overload.json).
2. Go to the **Analysis** screen:
   - Show the capacity warning: Total allocated CPU reaches **580 cores**, exceeding the Karnataka DC usable capacity of **460 cores**.
   - Explain to the judges: *"A naive optimizer might blindly place everything on-premise because it's cheaper per unit. SkyCash enforces strict capacity boundaries, alerting the infrastructure team before an overload crashes the private DC."*

---

## 🔍 Technical Talking Points for Judges

- **100% Deterministic & Auditable**: No black-box generative AI hallucinating placement decisions. Every single placement recommendation includes an explicit `audit_explanation` detailing why alternatives were rejected.
- **Privacy-First (Zero Cloud Leakage)**: Highly confidential banking infrastructure data stays strictly inside the local process boundary.
- **Latency & Co-Location Awareness**: Uses disjoint-set / union-find graph algorithms to group services requiring sub-5ms communication, ensuring distributed microservices are never broken across WAN boundaries.
- **Decision Support, Not Execution**: SkyCash is architected to empower CIOs and infrastructure leads with decision support—it does not execute live cloud migrations or connect to cloud accounts.
