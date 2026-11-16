import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Layout uses logical properties only (docs/design/system.md), so one
// stylesheet serves both directions. This flags the physical Tailwind
// utilities (ml-*, pr-*, text-left, left-0, rounded-l, …) inside class strings.
// Variants (md:, data-[x]:) are skipped over; `ms`/`me`/`ps`/`pe`/`start`/`end`
// are the replacements.
const PHYSICAL_UTILITY =
  "(^|\\s)(?:[^\\s:]+:)*!?-?(?:m[lr]|p[lr]|scroll-m[lr]|scroll-p[lr]|border-[lr]|rounded-(?:[tb]?[lr])|text-(?:left|right)|float-(?:left|right)|clear-(?:left|right)|left|right)(?:-|\\s|$)";

const physicalClassMessage =
  "Use logical utilities (ms/me/ps/pe/start/end/text-start/text-end/rounded-s/rounded-e/border-s/border-e) instead of left/right ones.";

const classStringSelectors = [
  "JSXAttribute[name.name='className'] Literal",
  "JSXAttribute[name.name='className'] TemplateElement",
  "CallExpression[callee.name=/^(cn|cva|clsx)$/] Literal",
  "CallExpression[callee.name=/^(cn|cva|clsx)$/] TemplateElement",
];

const physicalClassRules = classStringSelectors.map((selector) => ({
  selector: `${selector}[value=/${PHYSICAL_UTILITY}/]`,
  message: physicalClassMessage,
}));

// Server code reads time only from an injected Clock (src/lib/clock.ts), so
// tests control it. `new Date(value)` with an argument is fine; asking the system
// for "now" is not.
const clockRules = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: "Use the injected Clock (ctx.clock.now()), not new Date().",
  },
  {
    selector:
      "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "Use the injected Clock (ctx.clock.now()), not Date.now().",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": ["error", ...physicalClassRules],
      // Diagnostics go through the structured logger (src/lib/logger.ts, ADR-017).
      "no-console": "error",
    },
  },
  {
    // Server code. The browser keeps its own time (countdowns), and tests may
    // use real time. The clock itself is the one allowed caller.
    files: [
      "src/api/**",
      "src/lib/**",
      "src/services/**",
      "src/operations/**",
      "src/jobs/**",
    ],
    ignores: ["src/lib/clock.ts", "**/*.test.ts", "src/test/**"],
    rules: {
      "no-restricted-syntax": ["error", ...physicalClassRules, ...clockRules],
    },
  },
  // Must stay last: turns off stylistic rules that would fight Prettier.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
