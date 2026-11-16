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

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        ...classStringSelectors.map((selector) => ({
          selector: `${selector}[value=/${PHYSICAL_UTILITY}/]`,
          message: physicalClassMessage,
        })),
      ],
    },
  },
  // Must stay last: turns off stylistic rules that would fight Prettier.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
