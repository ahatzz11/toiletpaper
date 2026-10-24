// Runs public/data.js and public/core.js (plain browser scripts) in Node, so the build renders
// pages with the same code the browser runs.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

export function loadCore(root) {
  const dataSource = readFileSync(join(root, "public/data.js"), "utf8");
  const coreSource = readFileSync(join(root, "public/core.js"), "utf8");
  // Wrapped in a function so their top-level vars stay out of Node's globals.
  const run = vm.runInThisContext(`(function () {\n${dataSource}\n${coreSource}\nreturn { TP_DATA, TPCore };\n})`, { filename: "core.js" });
  const { TP_DATA, TPCore } = run();
  return { D: TP_DATA, Core: TPCore, dataSource, coreSource };
}
