import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCOPE = "@dramatis-personae/";
const SAMPLES = `${SCOPE}samples`;

/** Internal packages each package may depend on (ADR 0007). */
export const ALLOWED: Record<string, string[]> = {
  [`${SCOPE}schema`]: [],
  [`${SCOPE}core`]: [`${SCOPE}schema`],
  [`${SCOPE}graph`]: [],
  [`${SCOPE}api-client`]: [],
  [`${SCOPE}server`]: [`${SCOPE}core`, `${SCOPE}schema`],
  [`${SCOPE}web`]: [`${SCOPE}graph`, `${SCOPE}api-client`, `${SCOPE}schema`],
  [`${SCOPE}desktop`]: [`${SCOPE}server`],
  [SAMPLES]: [`${SCOPE}schema`],
};

export interface PackageDeps {
  name: string;
  deps: string[];
  devDeps?: string[];
}

export function findViolations(
  packages: PackageDeps[],
  allowed: Record<string, string[]>,
): string[] {
  const violations: string[] = [];
  for (const pkg of packages) {
    const permitted = allowed[pkg.name] ?? [];
    const check = (dep: string, isDev: boolean) => {
      if (!dep.startsWith(SCOPE)) return;
      // The sample world is a test fixture: any package may use it in tests.
      if (isDev && dep === SAMPLES) return;
      if (!permitted.includes(dep)) violations.push(`${pkg.name} may not depend on ${dep}`);
    };
    for (const dep of pkg.deps) check(dep, false);
    for (const dep of pkg.devDeps ?? []) check(dep, true);
  }
  return violations;
}

function readWorkspacePackages(root: string): PackageDeps[] {
  const packages: PackageDeps[] = [];
  for (const group of ["apps", "packages", "samples"]) {
    const dir = join(root, group);
    if (!existsSync(dir)) continue;
    const candidates =
      group === "samples" ? [dir] : readdirSync(dir).map((name) => join(dir, name));
    for (const candidate of candidates) {
      const manifest = join(candidate, "package.json");
      if (!existsSync(manifest)) continue;
      const json = JSON.parse(readFileSync(manifest, "utf8")) as {
        name: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      packages.push({
        name: json.name,
        deps: Object.keys(json.dependencies ?? {}),
        devDeps: Object.keys(json.devDependencies ?? {}),
      });
    }
  }
  return packages;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const violations = findViolations(readWorkspacePackages(root), ALLOWED);
  for (const line of violations) console.error(line);
  process.exit(violations.length > 0 ? 1 : 0);
}
