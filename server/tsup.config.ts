import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: true,
  bundle: true,
  minify: false, // Disable minification for better error traces in production
  target: "node18",
  platform: "node",
  external: [
    // External native modules that shouldn't be bundled
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/lib-dynamodb",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "@aws-sdk/client-bedrock-runtime",
    "@aws-sdk/client-cognito-identity-provider",
    "aws-jwt-verify",
  ],
  noExternal: [
    // Force bundling of these modules
    "dotenv",
  ],
  tsconfig: "./tsconfig.json",
});
