import { defineConfig } from "tsup";
import { baseConfig } from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  // GraphQL package only outputs CJS (matching original tsc behavior)
  format: ["cjs", "esm"],
});
