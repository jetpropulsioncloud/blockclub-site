// Lightweight syntax check: application JavaScript and inline HTML scripts.
// Deliberately excludes committed vendor files under node_modules.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const javascript = [
  "builder.js",
  "firebase.js",
  "server.js",
  "preview.js",
  "functions/index.js",
  "scripts/seedPublicServers.js",
];
const html = [
  "index.html",
  "builder.html",
  "premium.html",
  "preview.html",
  "server.html",
  "submit.html",
];
let checked = 0;
const failures = [];

function validate(label, source, isModule) {
  const mode = isModule ? "module" : "commonjs";
  const run = spawnSync(process.execPath, ["--check", "--input-type=" + mode], {
    input: source,
    encoding: "utf8",
  });
  checked++;
  if (run.status !== 0) {
    failures.push(label + "\n" + (run.stderr || run.stdout || "Syntax validation failed."));
  }
}

for (const file of javascript) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const isModule = ["firebase.js", "server.js"].includes(file);
  validate(file, source, isModule);
}

for (const file of html) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let index = 0;
  while ((match = scriptRegex.exec(source))) {
    const attributes = match[1];
    const script = match[2];
    if (/\bsrc\s*=/.test(attributes) || !script.trim()) continue;
    const typeMatch = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const type = (typeMatch?.[1] || "text/javascript").toLowerCase();
    if (!["text/javascript", "application/javascript", "module"].includes(type)) continue;
    validate(file + " inline script " + (++index), script, type === "module");
  }
}

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exitCode = 1;
} else {
  console.log("Syntax OK: " + checked + " application scripts checked.");
}
