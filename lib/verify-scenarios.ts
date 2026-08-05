/**
 * Verify lingbot-cases scenarios against the StructuredExample schema.
 *
 * Checks:
 * - Required fields (id, name, image, scene)
 * - Layer registries have "default" key
 * - Event version references exist
 * - Event gates reference valid fired event names
 * - Character/environment event split is consistent
 *
 * Run via CLI:
 *   npx ts-node lib/verify-scenarios.ts
 *
 * Or import:
 *   import { verifyAllScenarios, verifyScenario } from '@/lib/verify-scenarios'
 */

import type {
  StructuredExample,
  StructuredScene,
  NamedEvent,
} from "./lingbot-world-prompts";

export interface VerificationError {
  file: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface VerificationResult {
  file: string;
  valid: boolean;
  errors: VerificationError[];
}

/**
 * Verify a single scenario object against the schema.
 */
export function verifyScenario(
  data: unknown,
  filename: string
): VerificationResult {
  const errors: VerificationError[] = [];

  // Type guard: check if it's an object
  if (!data || typeof data !== "object") {
    return {
      file: filename,
      valid: false,
      errors: [
        {
          file: filename,
          field: "root",
          message: "Scenario must be a JSON object",
          severity: "error",
        },
      ],
    };
  }

  const example = data as Record<string, unknown>;

  // Required top-level fields
  if (!example.id || typeof example.id !== "string") {
    errors.push({
      file: filename,
      field: "id",
      message: 'Required field "id" must be a string',
      severity: "error",
    });
  }

  if (!example.name || typeof example.name !== "string") {
    errors.push({
      file: filename,
      field: "name",
      message: 'Required field "name" must be a string',
      severity: "error",
    });
  }

  if (!example.image || typeof example.image !== "object") {
    errors.push({
      file: filename,
      field: "image",
      message: 'Required field "image" must be an object',
      severity: "error",
    });
  } else {
    const img = example.image as Record<string, unknown>;
    if (!img.src || typeof img.src !== "string") {
      errors.push({
        file: filename,
        field: "image.src",
        message: 'image.src must be a string (e.g., "public/lingbot-cases/farmer.jpg")',
        severity: "error",
      });
    }
  }

  if (!example.scene || typeof example.scene !== "object") {
    errors.push({
      file: filename,
      field: "scene",
      message: 'Required field "scene" must be an object',
      severity: "error",
    });
    // Early return — can't validate scene contents without scene object
    return {
      file: filename,
      valid: errors.length === 0,
      errors,
    };
  }

  const scene = example.scene as Record<string, unknown>;

  // Validate scene structure
  const sceneErrors = verifySceneStructure(scene, filename);
  errors.push(...sceneErrors);

  return {
    file: filename,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verify the scene object structure.
 */
function verifySceneStructure(
  scene: Record<string, unknown>,
  filename: string
): VerificationError[] {
  const errors: VerificationError[] = [];

  // Required layers
  if (!scene.base || typeof scene.base !== "object") {
    errors.push({
      file: filename,
      field: "scene.base",
      message: 'Required field "base" must be an object (LayerRegistry)',
      severity: "error",
    });
  } else {
    const baseErrors = verifyLayerRegistry(
      scene.base as Record<string, unknown>,
      "scene.base",
      filename
    );
    errors.push(...baseErrors);
  }

  if (!scene.camera || typeof scene.camera !== "object") {
    errors.push({
      file: filename,
      field: "scene.camera",
      message:
        'Required field "camera" must be an object with {static, dynamic} variants',
      severity: "error",
    });
  } else {
    const cameraErrors = verifyLayerRegistry(
      scene.camera as Record<string, unknown>,
      "scene.camera",
      filename,
      true
    );
    errors.push(...cameraErrors);
  }

  if (!scene.movement || typeof scene.movement !== "object") {
    errors.push({
      file: filename,
      field: "scene.movement",
      message:
        'Required field "movement" must be an object with {static, dynamic} variants',
      severity: "error",
    });
  } else {
    const movementErrors = verifyLayerRegistry(
      scene.movement as Record<string, unknown>,
      "scene.movement",
      filename,
      true
    );
    errors.push(...movementErrors);
  }

  // Optional but should be present
  if (!scene.events || !Array.isArray(scene.events)) {
    errors.push({
      file: filename,
      field: "scene.events",
      message: 'Field "events" should be an array',
      severity: "warning",
    });
  } else {
    const eventErrors = verifyEvents(
      scene.events as unknown[],
      scene as Record<string, unknown>,
      filename
    );
    errors.push(...eventErrors);
  }

  // Optional fields
  if (scene.hud && typeof scene.hud !== "object") {
    errors.push({
      file: filename,
      field: "scene.hud",
      message: 'Field "hud" must be an object',
      severity: "error",
    });
  }

  if (scene.jumpPrompt && typeof scene.jumpPrompt !== "string") {
    errors.push({
      file: filename,
      field: "scene.jumpPrompt",
      message: 'Field "jumpPrompt" must be a string',
      severity: "error",
    });
  }

  if (scene.crouchPrompt && typeof scene.crouchPrompt !== "string") {
    errors.push({
      file: filename,
      field: "scene.crouchPrompt",
      message: 'Field "crouchPrompt" must be a string',
      severity: "error",
    });
  }

  if (scene.standPrompt && typeof scene.standPrompt !== "string") {
    errors.push({
      file: filename,
      field: "scene.standPrompt",
      message: 'Field "standPrompt" must be a string',
      severity: "error",
    });
  }

  return errors;
}

/**
 * Verify a layer registry (must have "default" key, values are strings or {static,dynamic}).
 */
function verifyLayerRegistry(
  layer: Record<string, unknown>,
  path: string,
  filename: string,
  isShotVariant: boolean = false
): VerificationError[] {
  const errors: VerificationError[] = [];

  if (!("default" in layer)) {
    errors.push({
      file: filename,
      field: `${path}.default`,
      message: `Layer registry must have a "default" key`,
      severity: "error",
    });
  }

  // Check variant structure
  for (const [key, value] of Object.entries(layer)) {
    if (isShotVariant) {
      // Must be {static, dynamic}
      if (typeof value !== "object" || value === null) {
        errors.push({
          file: filename,
          field: `${path}.${key}`,
          message: `Shot variant must be an object with "static" and "dynamic" keys`,
          severity: "error",
        });
      } else {
        const variant = value as Record<string, unknown>;
        if (typeof variant.static !== "string") {
          errors.push({
            file: filename,
            field: `${path}.${key}.static`,
            message: `Shot variant.static must be a string`,
            severity: "error",
          });
        }
        if (typeof variant.dynamic !== "string") {
          errors.push({
            file: filename,
            field: `${path}.${key}.dynamic`,
            message: `Shot variant.dynamic must be a string`,
            severity: "error",
          });
        }
      }
    } else {
      // String variant
      if (typeof value !== "string") {
        errors.push({
          file: filename,
          field: `${path}.${key}`,
          message: `Layer variant must be a string`,
          severity: "error",
        });
      }
    }
  }

  return errors;
}

/**
 * Verify events array: required fields, type references, gate consistency.
 */
function verifyEvents(
  events: unknown[],
  scene: Record<string, unknown>,
  filename: string
): VerificationError[] {
  const errors: VerificationError[] = [];

  // Collect all event names for gate validation
  const eventNames = new Set<string>();
  const playerEventCount = events.filter(
    (e) => typeof e === "object" && e && (e as Record<string, unknown>).actor !== "environment"
  ).length;

  events.forEach((event, idx) => {
    if (typeof event !== "object" || !event) {
      errors.push({
        file: filename,
        field: `scene.events[${idx}]`,
        message: "Event must be an object",
        severity: "error",
      });
      return;
    }

    const e = event as Record<string, unknown>;
    const path = `scene.events[${idx}]`;

    // Required: name
    if (!e.name || typeof e.name !== "string") {
      errors.push({
        file: filename,
        field: `${path}.name`,
        message: 'Required field "name" must be a string',
        severity: "error",
      });
    } else {
      eventNames.add(e.name as string);
    }

    // Required: detail
    if (!e.detail) {
      errors.push({
        file: filename,
        field: `${path}.detail`,
        message: 'Required field "detail" must be a string or {static, dynamic}',
        severity: "error",
      });
    } else {
      const isString = typeof e.detail === "string";
      const isVariant =
        typeof e.detail === "object" &&
        e.detail &&
        typeof (e.detail as Record<string, unknown>).static === "string" &&
        typeof (e.detail as Record<string, unknown>).dynamic === "string";
      if (!isString && !isVariant) {
        errors.push({
          file: filename,
          field: `${path}.detail`,
          message: 'Field "detail" must be a string or {static, dynamic} object',
          severity: "error",
        });
      }
    }

    // Optional: actor (default "character")
    if (e.actor && typeof e.actor !== "string") {
      errors.push({
        file: filename,
        field: `${path}.actor`,
        message: 'Field "actor" must be "character" or "environment"',
        severity: "error",
      });
    }

    // Validate version references
    const baseRegistry = (scene.base || {}) as Record<string, unknown>;
    if (e.baseVersion && !(e.baseVersion in baseRegistry)) {
      errors.push({
        file: filename,
        field: `${path}.baseVersion`,
        message: `Version "${e.baseVersion}" not found in scene.base`,
        severity: "error",
      });
    }

    const cameraRegistry = (scene.camera || {}) as Record<string, unknown>;
    if (e.cameraVersion && !(e.cameraVersion in cameraRegistry)) {
      errors.push({
        file: filename,
        field: `${path}.cameraVersion`,
        message: `Version "${e.cameraVersion}" not found in scene.camera`,
        severity: "error",
      });
    }

    const movementRegistry = (scene.movement || {}) as Record<string, unknown>;
    if (e.movementVersion && !(e.movementVersion in movementRegistry)) {
      errors.push({
        file: filename,
        field: `${path}.movementVersion`,
        message: `Version "${e.movementVersion}" not found in scene.movement`,
        severity: "error",
      });
    }

    // Validate event gate references
    if (e.requires && typeof e.requires === "object") {
      const gate = e.requires as Record<string, unknown>;

      if (gate.fired && Array.isArray(gate.fired)) {
        (gate.fired as string[]).forEach((refName) => {
          if (!eventNames.has(refName)) {
            errors.push({
              file: filename,
              field: `${path}.requires.fired`,
              message: `Event gate references unknown event "${refName}"`,
              severity: "warning", // Warning because other events might be loaded
            });
          }
        });
      }

      if (gate.notFired && Array.isArray(gate.notFired)) {
        (gate.notFired as string[]).forEach((refName) => {
          if (!eventNames.has(refName)) {
            errors.push({
              file: filename,
              field: `${path}.requires.notFired`,
              message: `Event gate references unknown event "${refName}"`,
              severity: "warning",
            });
          }
        });
      }
    }

    // Warn if player event count > 9 (only first 9 get hotkeys)
    if (
      e.actor !== "environment" &&
      playerEventCount > 9 &&
      idx === playerEventCount - 1
    ) {
      errors.push({
        file: filename,
        field: `${path}`,
        message: `More than 9 player events (${playerEventCount}); only first 9 get hotkeys 1-9`,
        severity: "warning",
      });
    }
  });

  return errors;
}

/**
 * Verify all scenarios in lib/lingbot-cases/.
 * Used in Node.js environment or during build.
 */
export async function verifyAllScenarios(): Promise<VerificationResult[]> {
  const fs = await import("fs").then((m) => m.promises);
  const path = await import("path");

  const casesDir = path.join(process.cwd(), "lib", "lingbot-cases");
  const files = await fs.readdir(casesDir);
  const results: VerificationResult[] = [];

  for (const file of files.filter((f) => f.endsWith(".json"))) {
    try {
      const content = await fs.readFile(path.join(casesDir, file), "utf-8");
      const data = JSON.parse(content);
      const result = verifyScenario(data, file);
      results.push(result);
    } catch (err) {
      results.push({
        file,
        valid: false,
        errors: [
          {
            file,
            field: "parse",
            message: `Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
            severity: "error",
          },
        ],
      });
    }
  }

  return results;
}

/**
 * CLI: Run verification on all scenarios.
 */
if (require.main === module) {
  verifyAllScenarios().then((results) => {
    console.log(`\n📋 Verifying ${results.length} scenarios...\n`);

    let totalErrors = 0;
    let totalWarnings = 0;

    results.forEach((result) => {
      const errorCount = result.errors.filter((e) => e.severity === "error")
        .length;
      const warningCount = result.errors.filter((e) => e.severity === "warning")
        .length;

      totalErrors += errorCount;
      totalWarnings += warningCount;

      const status = result.valid ? "✅" : "❌";
      console.log(
        `${status} ${result.file} (${errorCount} error${errorCount !== 1 ? "s" : ""}, ${warningCount} warning${warningCount !== 1 ? "s" : ""})`
      );

      result.errors.forEach((err) => {
        const icon = err.severity === "error" ? "🔴" : "🟡";
        console.log(`   ${icon} ${err.field}: ${err.message}`);
      });
    });

    console.log(
      `\n📊 Total: ${totalErrors} error${totalErrors !== 1 ? "s" : ""}, ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}`
    );

    if (totalErrors > 0) {
      process.exit(1);
    }
  });
}
