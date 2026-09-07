# Unleash Flag Usage Companion (VS Code)

Inventories [Unleash](https://www.getunleash.io/) feature-flag usage
across your codebase — naming check, find-all-usages, likely-typo
detection. No data leaves your editor.

**v0.1, new niche.** Not a port from the Gap Hunter Labs IntelliJ-
family catalog. Evidence: confirmed total absence of a dedicated
Unleash VS Code extension despite Unleash being one of the most-used
open-source feature-flag tools — unlike LaunchDarkly and PostHog,
which both have one. The contrast makes the gap credible, not just
"nobody got to it yet."

## What it does

- **Command: `Unleash Flag Usage Companion: Show Flag Inventory`** —
  scans `.js`/`.ts`/`.jsx`/`.tsx`/`.py`/`.java`/`.go` files for
  `isEnabled('flag-name')`-shaped calls (JS/TS: `unleash.isEnabled`,
  Python: `unleash_client.is_enabled`, Java: `unleash.isEnabled`, Go:
  `unleash.IsEnabled`) and lists every distinct flag with every file
  and line it's checked at.
- **Naming check**: flags a name that isn't kebab-case — Unleash's
  own documentation examples consistently use kebab-case.
- **Likely-typo detection**: flags two differently-spelled names that
  normalize to the same thing (`my-flag` vs `myFlag`) — Unleash treats
  these as two entirely separate flags, so this is almost always a
  real bug: two call sites meant to check the same flag are actually
  checking two flags that never get toggled together.

Diagnostics update live on save of any applicable file.

**v0.1 scope, honestly noted:** this is a local, offline inventory —
whether a flag is still "live"/toggled in your actual Unleash instance
needs the Unleash Admin API, which this version doesn't call (no
network access, no credentials to configure). A flag with zero
remaining usages in your codebase, or one that's been 100% on for
months, isn't detected here — that's a real follow-up, not this v0.1.

## Privacy

See [PRIVACY.md](PRIVACY.md) — zero network calls, everything runs
against files already in your workspace.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
