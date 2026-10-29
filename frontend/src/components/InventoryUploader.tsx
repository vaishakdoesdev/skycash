import React, { useState } from 'react';
import { Workload } from '../types';

interface InventoryUploaderProps {
  onLoadCustom: (workloads: Workload[]) => void;
  onClose: () => void;
}

export const InventoryUploader: React.FC<InventoryUploaderProps> = ({
  onLoadCustom,
  onClose,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonText(content);
        validateAndParse(content);
      } catch (err: unknown) {
        setErrorMsg(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  };

  const validateAndParse = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('Inventory must be an array of Workload objects (e.g. [{ id: "...", ... }]).');
      }

      if (parsed.length === 0) {
        throw new Error('Inventory array is empty.');
      }

      // Check required fields on each workload
      for (let i = 0; i < parsed.length; i++) {
        const w = parsed[i];
        if (!w.id || typeof w.id !== 'string') {
          throw new Error(`Record at index ${i} is missing required string property 'id'.`);
        }
        if (!w.name || typeof w.name !== 'string') {
          throw new Error(`Workload '${w.id}' is missing required string property 'name'.`);
        }
        if (!w.data_sensitivity) {
          throw new Error(`Workload '${w.id}' is missing required 'data_sensitivity' (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED).`);
        }
        if (!w.residency_requirement) {
          throw new Error(`Workload '${w.id}' is missing required 'residency_requirement' (KARNATAKA_DC_ONLY, INDIA_ONLY, ANY_APPROVED_REGION).`);
        }
        if (typeof w.allocated_cpu_cores !== 'number' || w.allocated_cpu_cores <= 0) {
          throw new Error(`Workload '${w.id}' must have 'allocated_cpu_cores' > 0.`);
        }
        if (typeof w.allocated_ram_gib !== 'number' || w.allocated_ram_gib <= 0) {
          throw new Error(`Workload '${w.id}' must have 'allocated_ram_gib' > 0.`);
        }
        if (typeof w.allocated_storage_gib !== 'number' || w.allocated_storage_gib <= 0) {
          throw new Error(`Workload '${w.id}' must have 'allocated_storage_gib' > 0.`);
        }
      }

      setErrorMsg(null);
      onLoadCustom(parsed);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleManualSubmit = () => {
    if (!jsonText.trim()) {
      setErrorMsg('Please paste or upload a JSON array of workloads.');
      return;
    }
    validateAndParse(jsonText);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content uploader-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Load Local Workload Inventory</h2>
            <div className="modal-placement-row">
              Evaluate your local workloads offline without uploading to third-party endpoints
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="uploader-dropzone">
            <input
              type="file"
              accept=".json"
              id="file-input"
              className="file-hidden-input"
              onChange={handleFileUpload}
            />
            <label htmlFor="file-input" className="dropzone-label">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Click to select local JSON inventory file</span>
              <span className="text-muted text-xs">Files stay completely offline in browser memory</span>
            </label>
          </div>

          <div className="or-divider">or paste JSON directly</div>

          <div className="json-paste-area">
            <textarea
              rows={8}
              placeholder='[ { "id": "wl-custom-1", "name": "Payment Service", "environment": "production", "current_placement": "karnataka-dc-1", "data_sensitivity": "CONFIDENTIAL", "residency_requirement": "INDIA_ONLY", "allocated_cpu_cores": 16, "allocated_ram_gib": 64, "allocated_storage_gib": 500, "required_certifications": ["ISO27001"] } ]'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
          </div>

          {errorMsg && (
            <div className="uploader-error">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleManualSubmit}>
            Validate & Run Placement Engine
          </button>
        </div>
      </div>
    </div>
  );
};
