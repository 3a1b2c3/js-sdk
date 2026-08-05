"use client";

/**
 * Scenario Editor - Phase 2
 *
 * Load, edit, validate, and test scenarios without raw JSON.
 * Uses IntegrationSpec from the backend to validate inputs.
 * Tests scenarios through /api/scenario/test endpoint.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Scenario {
  scenario_id: string;
  name: string;
  description: string;
  spec_id: string;
  first_frame_prompt: string;
  inputs: any[];
  duration_s: number;
  metadata?: Record<string, any>;
}

interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export default function ScenarioEditor() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Load scenario from JSON file
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        setScenario({
          scenario_id: data.id || "unknown",
          name: data.name || "Untitled",
          description: data.description || "",
          spec_id: "lingbot-world-camera-control",
          first_frame_prompt: data.scene?.base?.default || "",
          inputs: [],
          duration_s: data.objective?.durationChunks || 8 * 0.75,
          metadata: data,
        });
      } catch (err) {
        console.error("Failed to parse scenario file:", err);
      }
    },
    []
  );

  // Validate scenario
  const handleValidate = useCallback(async () => {
    if (!scenario) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/scenario/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenario),
      });

      const data = await response.json();
      setValidationErrors(data.errors || []);
    } catch (err) {
      console.error("Validation failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [scenario]);

  // Test scenario
  const handleTest = useCallback(async () => {
    if (!scenario) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/scenario/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenario),
      });

      const data = await response.json();
      setTestResult(data);

      // Poll for completion
      if (data.job_id) {
        const pollInterval = setInterval(async () => {
          const pollResponse = await fetch(`/api/scenario/test/${data.job_id}`);
          const pollData = await pollResponse.json();

          setTestResult(pollData);

          if (pollData.status === "done" || pollData.status === "failed") {
            clearInterval(pollInterval);
          }
        }, 1000);
      }
    } catch (err) {
      console.error("Test failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [scenario]);

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel: Form */}
      <div className="w-96 border-r border-border p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">Scenario Editor</h1>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Load Scenario</label>
          <Input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="mb-4"
          />
        </div>

        {/* Scenario Info */}
        {scenario && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={scenario.name}
                onChange={(e) =>
                  setScenario({ ...scenario, name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={scenario.description}
                onChange={(e) =>
                  setScenario({ ...scenario, description: e.target.value })
                }
                className="w-full h-24 p-2 border border-input rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Duration (s)</label>
              <Input
                type="number"
                value={scenario.duration_s}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    duration_s: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Base Prompt</label>
              <textarea
                value={scenario.first_frame_prompt}
                onChange={(e) =>
                  setScenario({
                    ...scenario,
                    first_frame_prompt: e.target.value,
                  })
                }
                className="w-full h-32 p-2 border border-input rounded font-mono text-sm"
              />
            </div>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 rounded border border-red-200">
            <h3 className="font-semibold text-red-900 mb-2">Validation Issues</h3>
            <ul className="space-y-1 text-sm text-red-800">
              {validationErrors.map((err, i) => (
                <li key={i}>
                  <span className="font-mono">{err.field}:</span> {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleValidate}
            disabled={!scenario || isLoading}
            variant="outline"
            className="w-full"
          >
            {isLoading ? "Validating..." : "Validate"}
          </Button>

          <Button
            onClick={handleTest}
            disabled={!scenario || isLoading || validationErrors.some(e => e.severity === 'error')}
            className="w-full"
          >
            {isLoading ? "Testing..." : "Test Scenario"}
          </Button>
        </div>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Test Results</h2>

        {testResult ? (
          <div className="space-y-4">
            {testResult.status === "running" && (
              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-900">
                  Running... ({testResult.progress}%)
                </p>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${testResult.progress}%` }}
                  />
                </div>
              </div>
            )}

            {testResult.status === "done" && (
              <div className="p-4 bg-green-50 rounded border border-green-200">
                <h3 className="font-semibold text-green-900 mb-2">✅ Success</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="font-medium">Chunks:</dt>
                  <dd>{testResult.num_chunks}</dd>
                  <dt className="font-medium">Frames:</dt>
                  <dd>{testResult.num_frames}</dd>
                  <dt className="font-medium">Duration:</dt>
                  <dd>{testResult.duration_s.toFixed(2)}s</dd>
                  <dt className="font-medium">FPS:</dt>
                  <dd>{testResult.fps.toFixed(2)}</dd>
                </dl>
              </div>
            )}

            {testResult.status === "failed" && (
              <div className="p-4 bg-red-50 rounded border border-red-200">
                <h3 className="font-semibold text-red-900">❌ Failed</h3>
                <p className="text-sm text-red-800 mt-1">{testResult.error}</p>
              </div>
            )}

            {testResult.metrics && (
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="font-semibold mb-2">Metrics</h3>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(testResult.metrics, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">
            Load a scenario and click "Test Scenario" to see results.
          </p>
        )}
      </div>
    </div>
  );
}
