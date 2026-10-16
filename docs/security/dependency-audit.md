# Dependency security assessment — Phase 0.2

## Snapshot and decision

Audit snapshot and assessment date: **16 October 2026**. The supplied audit reports
**35 findings: 21 high and 14 moderate**, propagated from five underlying advisories.
These counts are historical, not the result of a new audit or proof of exploitability.

Baseline: Phase 0.1, commit `ab570f5`; locked Expo `55.0.31`, React Native `0.83.10`
and Expo Router `55.0.18`. The maintainer reports 46/46 tests passing, TypeScript,
ESLint and Prettier passing, and Expo Doctor 20/20. Those checks were not rerun here.

Evidence: committed manifests/lockfile, the supplied audit and fix-plan reports,
targeted parent call-site inspection, and the advisory links below. The fix-plan file
contains command-output text before its JSON; its audit still reports 35 findings.
Its suggestions include React Native `0.88.0`, Router `58.0.21` and an Expo downgrade
to `44.0.6`. None is an acceptable SDK 55 remediation.

**No dependency changes or new overrides applied.** No safe patch/minor remediation
was established from this evidence. All five advisories remain unresolved. Preserve
the existing root `expo-font: ~55.0.8` override, which addresses native-module duplication.
No manifest or lockfile edits, removals, forced fixes or audit suppressions were made.

## Advisory dispositions

### braces — high

- Locked path: `metro@0.83.8 -> metro-file-map@0.83.8 -> micromatch@4.0.8 -> braces@3.0.3`.
  Jest `29.7.0` packages also depend on micromatch. Its braces range is `^3.0.3`.
- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  covers versions through `3.0.3`; the advisory lists no patched version. Deeply nested
  brace patterns can exhaust the stack. Retain the version; no justified override target.
- Expected exposure is Metro/Jest file-pattern processing during development/builds.
  Untrusted configuration or generated glob patterns could affect developer/CI availability.
  Application bundle reachability was not inspected. Monitor braces, micromatch and
  Expo's Metro integration for a fix/backport compatible with SDK 55.

### node-forge — high

- Locked paths: `expo@55.0.31 -> @expo/cli@55.0.36 -> node-forge@1.4.0`, also
  `@expo/cli -> @expo/code-signing-certificates@0.0.6 -> node-forge`. Both parents
  request `^1.3.3`.
- [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
  affects versions through `1.4.0`; no patched version is listed. Malformed nested
  algorithm data can bypass certain RSA signature verification checks. Retain; no
  evidenced safe override. An older fix for another forge advisory is insufficient.
- Exposure includes CLI iOS signing/certificate tooling. The inspected certificate
  package actually calls certificate/public-key verification APIs, so this is not
  dismissed merely as tooling. Exploitation prerequisites, key characteristics and
  attacker control of certificate/signature inputs remain unverified. Monitor forge,
  Expo CLI and code-signing-certificates for a compatible corrected release.

### decode-uri-component — moderate

- Locked path: `expo-router@55.0.18 -> query-string@7.1.3 -> decode-uri-component@0.2.2`.
  query-string requests `^0.2.2`.
- [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
  affects versions through `0.4.2`; `0.5.0` is listed as patched against excessive
  decoding work on malformed percent-encoded input.
- Retain. This is not a compatible patch within `^0.2.2`: the
  [0.5.0 manifest](https://github.com/SamVerschueren/decode-uri-component/blob/v0.5.0/package.json)
  declares ESM and its entry exports a default function. The installed query-string
  uses `require('decode-uri-component')` and calls the returned value as a function.
  A direct override cannot be assumed compatible across Metro/web/native/Node.
- Router imports query-string in navigation code, making this a potential delivered-app
  concern. Whether attacker-controlled URLs actually reach the vulnerable decoder in
  the current routes has not been established. Monitor an SDK-55-compatible Router or
  query-string backport that safely integrates the fixed decoder. Prioritize this path
  before introducing external deep links or untrusted query inputs.

### sprintf-js — moderate

- Locked path: `react-native@0.83.10 -> babel-jest@29.7.0 -> babel-plugin-istanbul@6.1.1`,
  then `@istanbuljs/load-nyc-config@1.1.0 -> js-yaml@3.15.2 -> argparse@1.0.10`,
  then `sprintf-js@1.0.3`. argparse requests `~1.0.2`.
- [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
  affects versions through `1.1.3`; no patched version is listed. Unbounded precision
  specifiers in attacker-controlled format strings can throw and abort operations.
  Retain; upgrading to `1.1.3` would not address this advisory.
- Expected exposure is Babel/Istanbul/Jest tooling brought in by React Native, not
  a claim that MyFHIR's Vitest suite uses Jest. The inspected argparse formats help,
  usage and errors through sprintf. Attacker control of format strings and actual
  bundle inclusion remain unverified. Monitor sprintf-js and that parent chain for
  a fix or compatible removal; do not force a new argparse major under js-yaml.

### uuid — moderate

- Locked path: `@expo/config-plugins@55.0.11 -> xcode@3.0.1 -> uuid@7.0.3`.
  xcode requests `^7.0.3`.
- [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
  includes versions below `11.1.1`; patched branches listed include `11.1.1`, `12.0.1`
  and `13.0.1`. Certain UUID methods can silently perform partial writes into supplied
  output buffers when offsets/bounds are invalid.
- Retain. A scoped `xcode -> uuid@11.1.1` override is a candidate for a separately
  validated change, but crosses several majors outside the parent's range. Native
  project generation compatibility has not been validated; no new override is justified
  here. There is no evidenced patched 7.x target.
- The inspected xcode ID generator calls `uuid.v4()` without a supplied buffer; the
  advisory concerns the `v3/v5/v6` APIs, not that call. This reduces the evidence of
  reachability through this particular path, without resolving the advisory or proving
  all uses safe. Monitor xcode and Expo config-plugins for a compatible dependency update.

## Exposure and reassessment gates

Lockfile production/dev classification is not a reachability analysis: Expo/React Native
bring build tools through production dependency edges. Tooling can affect CI, signing
and release integrity even when absent from the delivered bundle. No bundle analysis,
exploit reproduction, clean installation or execution was performed in this milestone.

No issue has a demonstrated drop-in patch/minor fix in its current parent range.
The decoder and uuid have published fixes, but integration/backport or separately
validated parent-scoped changes are needed; a framework-major upgrade is not proven
necessary. Do not interpret npm's proposed framework changes as the only solutions.

Before real patient data or production builds:

1. Refresh the audit and advisory status against the exact proposed lockfile; review
   new findings and upstream fixes. Keep raw reports outside the repository.
2. Establish runtime/build reachability, especially URL decoding and signature verification;
   review trust boundaries for links, certificates, configuration and CI inputs.
3. For any candidate fix, verify parent API/module-format compatibility, retain the font
   override, regenerate the lockfile with npm locally and review the full diff. Validate
   SDK 55 dependencies, web/deep-link behavior and native generation/signing as applicable.
4. Run the checks below. Do not regard renderer tests or Expo Doctor as proof that a
   security advisory is fixed. Record an explicit release risk decision for each remaining
   finding before proceeding with real data or production distribution.

## Maintainer checks (not executed here)

From the repository root in PowerShell, using the existing synchronized lockfile:

```powershell
npm test
npm run typecheck
npm run lint
npm run format:check
Push-Location apps/patient
npx expo install --check
npx expo-doctor@latest
Pop-Location
npm audit
```

No install, audit/fix/dedupe, tests, builds, Expo commands, Docker, .NET commands or
automated validation were executed. No commits, pushes or issues were created.
