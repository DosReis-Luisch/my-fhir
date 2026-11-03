# Dependency security assessment — Phase 0.2

The Phase 0.2 sections below preserve the **16 October 2026 SDK 55 assessment**,
including its historical versions, decisions and validation notes. They are not the
current dependency inventory. See the [3 November 2026 SDK 57 baseline](#sdk-57-security-baseline--3-november-2026)
for the subsequent investigation and current reassessment prerequisites. No historical
finding is considered fixed merely because its chain is absent from the newer snapshot.

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

## SDK 57 security baseline — 3 November 2026

### Scope, evidence and decision

This dated baseline records the read-only investigation on `feat/patient-trends`.
Installed versions included Expo **57.0.31**, Expo Router **57.0.29**, React Native
**0.86.3**, React **19.2.3** and react-native-svg **15.15.4**. Evidence comprised
installed package manifests/source, dependency chains, online npm audit/registry
metadata and the upstream advisories linked below. It is not a production bundle
analysis or exploit demonstration.

- `npm audit`: **27 reported vulnerable dependency entries, including five high**
  (also 20 moderate and two low), reproduced by the investigation's online audit.
- `npm audit --omit=dev`: **16 entries, including five high**, supplied by the
  maintainer; this result was not independently rerun in the investigation.
- These are inherited package entries, not counts of independent vulnerabilities.
  The five high entries are decoder, query-string, Router, Zod and Expo CLI, arising
  from two high advisories. The reviewed tree has five underlying package families:
  decoder, Zod, glob, minimatch and deepmerge; the decoder has two advisories, giving
  six advisory IDs in this assessment.
- The maintainer reported **234 tests passing**, plus TypeScript, ESLint, Prettier
  and Expo Doctor passing before review. These checks were not rerun and do not
  demonstrate remediation, exploit resistance or production readiness. This security
  baseline does not complete or change the unfinished Phase 3C acceptance status.

**Decision: unresolved findings remain; no dependency fix or override is approved by
this assessment.** No compatible advisory-removing update was established within the
installed SDK 57 parent constraints. This documentation update ran no npm commands,
installation, tests, builds, Expo or proof-of-concept payloads and changed no dependency
files or Trends implementation.

`--omit=dev` follows dependency classification, not delivered application reachability.
Expo brings development/build tooling through production-declared dependency edges.
Conversely, tooling findings can affect developer/CI availability even when not shipped
in a mobile bundle. Neither audit mode establishes mobile-runtime exposure.

### URI decoding: high priority, application reachability unresolved

- **Chain:** `expo-router@57.0.29 -> query-string@7.1.3 -> decode-uri-component@0.2.2`.
  Parent ranges are query-string `^7.1.3` and decoder `^0.2.2`.
- **Advisories:** [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)
  (moderate, through `0.4.2`, fixed in `0.5.0`) and
  [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f)
  (high, through `0.5.0`, fixed in `0.5.1`). Malformed percent-encoded input can
  cause excessive decoding work. `0.5.0` is insufficient for the newer advisory.
- **Confirmed implementation facts:** `node_modules/query-string/index.js` calls
  the decoder from `decode()` during default `parse()` processing. Router's bundled
  `build/react-navigation/core/getStateFromPath.js` calls `queryString.parse()` in
  `parseQueryParams()`. This vulnerable fallback exists in installed code.
- **Confirmed normal path:** Under `node_modules/expo-router/`,
  `build/getLinkingConfig.js` supplies the custom parser through `build/ExpoRoot.js`
  and linking context. `build/fork/getStateFromPath-forks.js::parseQueryParams()`
  uses `URLSearchParams` through `build/utils/url.js`. Observed Router
  `queryString.stringify()` calls do not invoke the vulnerable decoder.
- **Inferred exposure / unknown runtime reachability:** Navigation helpers retain
  the core-parser fallback when a custom parser is absent. The normal path inspected
  uses the custom parser; selection of the vulnerable fallback by actual application
  navigation/deep links remains unproven. No production bundle tracing or exploit
  testing established attacker reachability. Failure to find another call is not proof
  of safety.
- **Compatibility and action:** Decoder `0.5.1` is outside the parent's range and
  uses an ESM default export, while query-string 7 expects a directly callable CommonJS
  `require()`. Query-string 10 removes the dependency but changes major version,
  module/API expectations and Node requirements. Neither blanket override is approved.
  Monitor/request an SDK 57-compatible Router backport or dependency removal.
  Any proposed URL size limits must precede parsing at applicable native/web ingress;
  record-detail or screen parameter checks occur too late and are not decoder mitigation.
- **Minimum candidate validation:** Trace release-bundle parser selection; verify
  cold/warm links and navigation on web/native, malformed encoding, Unicode, duplicate
  parameters and oversized input, plus CommonJS/ESM behavior.

### Zod: high, confirmed Expo CLI plugin-output validation

- **Chain:** `expo@57.0.31 -> @expo/cli@57.0.32 -> zod@3.25.76`; CLI requests
  `^3.25.76`.
- **Advisory:** [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
  affects versions below `4.6.6`. Excessive array validation can exhaust resources.
  The fix improves bounded-array rejection; unbounded schemas still require practical
  limits, as described in the [upstream discussion](https://github.com/colinhacks/zod/issues/6475).
- **Confirmed implementation facts:** Under
  `node_modules/expo/node_modules/@expo/cli/build/src/start/server/`,
  `DevToolsPlugin.schema.js` defines unbounded output arrays;
  `DevToolsPluginCliExtensionResults.js::parseOutputText()` performs `JSON.parse()`
  then `safeParse()`. `MCPDevToolsPluginCLIExtensions.js` also validates plugin results.
  The output ceiling uses V8's maximum string length rather than a practical small
  payload bound. These are tooling paths, not established mobile-runtime calls.
- **Inferred exposure:** Availability risk exists if an attacker can influence plugin
  metadata/output or data processed by enabled plugins. Generated MCP input schemas
  inspected use scalar parameters; no arbitrary incoming-array service path or
  unauthenticated remote exploitability was established. Enabled services, bindings,
  access controls and attacker influence remain exposure questions.
- **Compatibility and action:** Zod `4.6.6` supports CommonJS and ESM, but exceeds
  the CLI's major range and requires API/schema compatibility review. The inspected
  latest CLI 57 still requests Zod 3. No global Zod 4 override is approved. Monitor an
  upstream migration/backport; separately consider practical byte/cardinality bounds
  before JSON/schema processing where untrusted plugin output is possible.
- **Minimum candidate validation:** Plugin/MCP schema contracts, oversized/invalid
  output handling, bounded resource use and CLI compatibility. A version bump alone
  does not establish adequate input limits.

### Glob, minimatch and ESLint: tooling exposure requires call-path review

- **Chains:** Expo CLI/config/fingerprint use `glob@13.0.6 -> minimatch@10.2.6`.
  `@expo/fingerprint@0.20.14` and TypeScript-ESLint `8.71.2` also use minimatch 10;
  ESLint `9.39.5` and its configuration dependencies resolve minimatch `3.1.5`.
- **Advisories:** [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
  covers glob `9` through `14.0.1`, fixed in `14.0.2`, for abort-related recursion/resource
  exhaustion. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
  covers minimatch below `11.0.1`, fixed in `11.0.1`, for excessive pattern expansion.
- **Confirmed implementation facts:** `node_modules/glob/dist/commonjs/glob.js`
  forces `optimizationLevel: 2`, selecting the minimatch expansion mode of concern.
  `glob/dist/commonjs/walker.js` contains affected abort handling. Expo CLI's
  `build/src/utils/glob.js::anyMatchAsync()` aborts a glob stream after a match, but
  no caller beyond its definition was found: execution in the current workflow is
  unproven. Expo config and route discovery use glob with project/tooling patterns.
- **Inferred exposure / limits:** Attacker control of patterns, configuration or abort
  paths was not established. Fingerprint's direct minimatch call and TypeScript-ESLint's
  `typescript-estree/dist/useProgramFromProjectService.js` do not select level 2;
  current ESLint configuration does not enable that project-service path. Minimatch 3
  lacks the particular level-2 preprocessing implementation; its inclusion in the broad
  advisory range needs clarification, not dismissal of the finding.
- **Compatibility and action:** Glob parents request `^13.0.0`; minimatch parents
  request 10.x or 3.x. Patched glob 14/minimatch 11 support CommonJS and ESM, but
  exceed those ranges and change dependency/API internals. No blanket major override
  is approved. Monitor coordinated upstream upgrades/backports. The inspected compatible
  TypeScript-ESLint `8.72.1` still requests minimatch `^10.2.2`; upgrading ESLint to the
  inspected 10.x release also retains minimatch 10, so neither establishes remediation.
- **Minimum candidate validation:** Windows paths, ignores, braces/extglobs, symlinks,
  Expo route/asset discovery, configuration/native generation and cancellation behavior;
  actual flat-config linting and TypeScript compatibility for lint-tool changes.

### Deepmerge: low, configuration/plugin merge boundary

- **Chain:** `expo -> @expo/config@57.0.10 -> deepmerge@4.3.1`; config requests
  `^4.3.1`.
- **Advisory:** [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
  covers `4.2.0` through `4.3.1`, with no published patched release at review time.
  Unsafe merges can affect the returned object's prototype; this is not evidence of
  global `Object.prototype` modification in the observed path.
- **Confirmed implementation facts:** `node_modules/@expo/config/build/Config.js`
  uses deepmerge in `mergeConfigModifications()` and plugin-property merging.
  No mobile-runtime or exposed-service input flow was established.
- **Inferred exposure and action:** Untrusted configuration/plugin objects could cross
  this boundary. Monitor upstream; if such objects are accepted, separately review
  dangerous-key and own-property handling. No patched override target was established.
- **Minimum candidate validation:** Existing config/plugin merge semantics, dangerous-key
  regression cases and applicable Expo configuration generation.

### Fix policy, existing boundaries and monitoring

The maintainer's prior `npm audit fix --dry-run` did not establish a compatible fix for
the main Expo chains. The read-only investigation did not run audit fix or rerun its
dry-run, and the complete earlier plan was not available for comparison. Online audit
suggestions included incompatible major changes/downgrades; `fixAvailable: true` is
not proof of an SDK-compatible solution. No advisory-removing non-forced fix was
verified. Incidental compatible updates must be assessed by remaining advisory IDs and
resolved chains, not by the number of packages updated.

Automatic fixes, forced framework changes, incompatible majors and blanket overrides
are not approved by this baseline. Candidate parent-scoped fixes require separate review
of semver constraints, module shape and APIs, lockfile diff and SDK/native compatibility.
Published upstream fixes are not proof they can be substituted safely into this tree.

Existing risk-reducing boundaries are synthetic-only data and the absence of implemented
external acquisition/authentication connections, plus the normal Router parser described
above. These are limited facts, not fixes or a security boundary against malicious links.
No pre-parser URL cap or practical plugin-output cap was established. Trusted tooling
inputs, restricted development-service access and new input caps are controls to verify
or implement separately, not controls claimed implemented by this document. Clinical
source/patient consistency checks do not mitigate dependency parsing vulnerabilities.

Monitor Expo SDK 57 Router/CLI/config/fingerprint and their affected upstream packages.
Recheck advisory ranges, newly published backports, plugin/service enablement, URL parser
selection and release-bundle inclusion when dependencies or ingress paths change.

### Release and external-connection prerequisites

Before enabling external connections (including a synthetic sandbox), using real patient
data or distributing a production release:

1. Refresh full and omit-dev audits against the exact candidate lockfile and current
   advisories. Preserve dated counts and chain evidence; do not overwrite this history
   or infer remediation from a changed scanner count alone.
2. Establish delivered web/native bundle reachability and parser selection. Review all
   external URL/deep-link ingress, input bounds and fallback paths. Resolve or explicitly
   disposition the unknown decoder exposure before accepting untrusted links.
3. Review enabled CLI/plugin/MCP services, binding/access controls, untrusted output and
   configuration/pattern inputs, including CI. Separate confirmed calls from attacker
   reachability and document remaining unknowns.
4. For each candidate fix, review parent/module/API compatibility and the complete
   manifest/lockfile diff; run focused security-boundary regressions and applicable
   tests, typecheck, lint, formatting, Expo compatibility/Doctor, web/native navigation
   and tooling checks. The family-specific minimum checks above remain prerequisites.
5. Record a maintainer release decision for every unresolved advisory and unknown
   exposure, with mitigation/evidence and reassessment ownership. This baseline does
   not authorize production distribution or real-data/external integration; the backlog's
   identity, authorization, privacy and data-handling gates also remain in force.
