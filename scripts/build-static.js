#!/usr/bin/env node
/**
 * Static build for cPanel-style hosting.
 *
 * Next.js refuses `output: 'export'` while API route handlers exist, so we
 * temporarily move `src/app/api` aside, run the build with STATIC_EXPORT=1,
 * and restore the folder afterwards. The result is plain HTML/JS/CSS in
 * `out/` that can be uploaded to any static host.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const apiDir = path.join(root, "src", "app", "api");
const stashDir = path.join(root, "src", "app", "_api.disabled");

let stashed = false;

function stash() {
  if (fs.existsSync(apiDir)) {
    if (fs.existsSync(stashDir)) {
      throw new Error(
        `Refusing to stash: ${stashDir} already exists. ` +
          "Last build was interrupted — move or delete it manually before retrying.",
      );
    }
    fs.renameSync(apiDir, stashDir);
    stashed = true;
  }
}

function restore() {
  if (stashed && fs.existsSync(stashDir)) {
    fs.renameSync(stashDir, apiDir);
    stashed = false;
  }
}

process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(143);
});
process.on("uncaughtException", (err) => {
  restore();
  console.error(err);
  process.exit(1);
});

try {
  stash();

  const result = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1" },
  });

  restore();

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log("\nStatic build ready: ./out");
  console.log("Upload the contents of ./out/ to your cPanel public_html/.");
} finally {
  restore();
}
