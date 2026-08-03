import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // PRD NFR-2: the simulation must be deterministic and isomorphic.
  // Anything below makes a run irreproducible, which breaks device timing
  // parity (FR-9.5) and replay validation (FR-15.7) at the same time.
  // See src/sim/README.md for the reasoning.
  {
    files: ["src/sim/**/*.ts", "src/sim/**/*.tsx"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "The simulation must run headless on the server. No DOM." },
        { name: "document", message: "The simulation must run headless on the server. No DOM." },
        { name: "localStorage", message: "The simulation owns no persistence." },
        { name: "fetch", message: "The simulation takes inputs; it does not fetch them." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Unseedable and engine-specific. Use createRng() from ./rng." },
        { object: "Date", property: "now", message: "The sim advances in ticks, not wall-clock time." },
        { object: "performance", property: "now", message: "The sim advances in ticks, not wall-clock time." },
        { object: "Math", property: "sin", message: "Transcendentals are implementation-defined and differ across platforms." },
        { object: "Math", property: "cos", message: "Transcendentals are implementation-defined and differ across platforms." },
        { object: "Math", property: "tan", message: "Transcendentals are implementation-defined and differ across platforms." },
        { object: "Math", property: "pow", message: "Transcendentals are implementation-defined and differ across platforms." },
        { object: "Math", property: "exp", message: "Transcendentals are implementation-defined and differ across platforms." },
        { object: "Math", property: "log", message: "Transcendentals are implementation-defined and differ across platforms." },
        { object: "Math", property: "atan2", message: "Transcendentals are implementation-defined and differ across platforms." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: "The sim advances in ticks, not wall-clock time.",
        },
      ],
    },
  },
]);

export default eslintConfig;
