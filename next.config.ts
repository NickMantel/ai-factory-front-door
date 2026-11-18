import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { NextConfig } from "next";
import { parseFramework } from "./src/lib/framework";

// The evaluation framework this build uses: frameworks/<FRAMEWORK>.md, "default" unless set.
const framework = process.env.FRAMEWORK || "default";
const frameworkPath = `./frameworks/${framework}.md`;
if (!existsSync(frameworkPath)) {
  const available = readdirSync("./frameworks").filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
  throw new Error(`FRAMEWORK=${framework}, but there is no ${frameworkPath}. Available: ${available.join(", ")}.`);
}
// Fail fast with a readable message, before anything is compiled.
parseFramework(readFileSync(frameworkPath, "utf8"), frameworkPath.slice(2));

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    resolveAlias: {
      "@framework": frameworkPath,
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      "*.md": {
        type: "raw",
      },
    },
  },
};

export default nextConfig;
