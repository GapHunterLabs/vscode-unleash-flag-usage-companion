/**
 * Pure logic -- no `vscode` dependency. New niche (not a port from
 * the Kotlin catalog). Evidence: confirmed total absence of a
 * dedicated Unleash VS Code extension despite Unleash being one of
 * the most-used open-source feature-flag tools -- unlike LaunchDarkly
 * and PostHog, which both have one. v0.1 scope: a local, offline
 * inventory of `isEnabled('flag-name')`-shaped calls across a
 * workspace -- real flag "staleness" (is this flag still toggled
 * anywhere in a live Unleash instance) needs the Unleash Admin API,
 * out of scope for a zero-network v0.1.
 */

export interface FlagUsage {
  flagName: string;
  file: string;
  line: number; // 1-based
}

// Matches isEnabled('flag-name')/IsEnabled("flag-name") on any
// receiver, across the common Unleash SDK call shapes (JS/TS:
// unleash.isEnabled, Python: unleash_client.is_enabled, Java:
// unleash.isEnabled, Go: unleash.IsEnabled) -- name-based, not
// resolved-symbol-based, same principle as this workstream's other
// signal-name scanners (SqlSignalNames, LogSignalNames).
const IS_ENABLED_CALL = /\b(?:is_enabled|isEnabled|IsEnabled)\s*\(\s*(['"])([^'"]+)\1/g;

export function findFlagUsages(filePath: string, text: string): FlagUsage[] {
  const usages: FlagUsage[] = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(IS_ENABLED_CALL)) {
      usages.push({ flagName: match[2], file: filePath, line: index + 1 });
    }
  });
  return usages;
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface NamingViolation {
  flagName: string;
  usages: FlagUsage[];
}

/** Unleash's own documentation examples consistently use kebab-case
 * flag names (e.g. "my-feature-flag"). Flags a name that doesn't
 * conform -- one violation per distinct non-conforming name, listing
 * every place it's used. */
export function findNamingViolations(usages: FlagUsage[]): NamingViolation[] {
  const byName = groupByFlagName(usages);
  const violations: NamingViolation[] = [];
  for (const [flagName, flagUsages] of byName) {
    if (!KEBAB_CASE.test(flagName)) {
      violations.push({ flagName, usages: flagUsages });
    }
  }
  return violations;
}

export interface LikelyTypoGroup {
  normalizedKey: string;
  variants: { flagName: string; usages: FlagUsage[] }[];
}

function normalize(flagName: string): string {
  return flagName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Groups flags that normalize to the same key (case/separators
 * stripped) but are spelled differently in the source -- e.g.
 * "my-flag" in one file and "myFlag" in another. Almost always a
 * real bug: two call sites that were meant to check the same flag
 * are checking two different (never-toggled-together) flag names
 * instead, because Unleash treats them as entirely distinct flags. */
export function findLikelyTypoGroups(usages: FlagUsage[]): LikelyTypoGroup[] {
  const byName = groupByFlagName(usages);
  const byNormalized = new Map<string, Map<string, FlagUsage[]>>();

  for (const [flagName, flagUsages] of byName) {
    const key = normalize(flagName);
    if (!byNormalized.has(key)) byNormalized.set(key, new Map());
    byNormalized.get(key)!.set(flagName, flagUsages);
  }

  const groups: LikelyTypoGroup[] = [];
  for (const [key, variantsMap] of byNormalized) {
    if (variantsMap.size > 1) {
      groups.push({
        normalizedKey: key,
        variants: [...variantsMap.entries()].map(([flagName, flagUsages]) => ({ flagName, usages: flagUsages })),
      });
    }
  }
  return groups;
}

function groupByFlagName(usages: FlagUsage[]): Map<string, FlagUsage[]> {
  const map = new Map<string, FlagUsage[]>();
  for (const usage of usages) {
    if (!map.has(usage.flagName)) map.set(usage.flagName, []);
    map.get(usage.flagName)!.push(usage);
  }
  return map;
}
