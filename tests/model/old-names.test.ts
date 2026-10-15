import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const script = join(repo, "scripts/check-old-names.mjs");

let sandbox: string;
beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), "old-names-"));
});
afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

// Runs the check from `cwd`, as a developer runs it from the repo root.
function check(cwd: string, args: string[] = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

// Makes a new, empty project folder holding the given files.
function project(name: string, files: Record<string, string>) {
  const dir = join(sandbox, name);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

describe("old-names check", () => {
  it("passes on the new UI as it is", () => {
    const result = check(repo);
    expect(result.status, result.output).toBe(0);
  });

  it("fails on a planted old word and names the file and line", () => {
    const dir = project("wording", {
      "src/veil/hello.tsx": "export const a = 1;\n<h1>Welcome back</h1>\n",
    });
    const result = check(dir, ["src"]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('src/veil/hello.tsx:2: found "Welcome back"');
  });

  it("fails on an old component name in an import", () => {
    const dir = project("component", {
      "src/veil/x.tsx": 'import { AppShell } from "./shell";\n',
    });
    expect(check(dir, ["src"]).status).toBe(1);
  });

  it("catches old import paths and old style names", () => {
    const dir = project("paths", {
      "src/veil/a.tsx": 'import { Button } from "@/components/ui/button";\n',
      "src/veil/b.css": ".x { color: var(--terracotta); }\n",
    });
    const result = check(dir, ["src"]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("src/veil/a.tsx:1");
    expect(result.output).toContain("src/veil/b.css:1");
  });

  it("accepts the new brand, which differs from the old one only in case", () => {
    const dir = project("brand", { "src/veil/brand.tsx": "<p>Our wedding planner</p>\n" });
    expect(check(dir, ["src"]).status).toBe(0);
  });

  it("skips the paths matched by --exclude", () => {
    const dir = project("exclude", {
      "src/app/(legacy)/old/page.tsx": "<AppShell />\n",
      "src/veil/ok.tsx": "export {};\n",
    });
    expect(check(dir, ["src"]).status).toBe(1);
    expect(check(dir, ["src", "--exclude", "src/app/(legacy)/**"]).status).toBe(0);
  });

  it("exits 2 when a root does not exist", () => {
    const dir = project("missing", { "src/veil/ok.tsx": "export {};\n" });
    expect(check(dir, ["nowhere"]).status).toBe(2);
  });
});
