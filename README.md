# MyFHIR

A FHIR-native patient application and the beginnings of a reusable FHIR presentation
engine. The application uses **only fictional data**, runs from Expo, and keeps
clinical resources in their native HL7 FHIR R4 shape.

## Structure

```text
apps/patient/             Expo Router application (web, Android, iOS)
packages/fhir-core/       Portable R4 types, identity and safe-access helpers
packages/fhir-renderer/   Portable interpretation and presentation descriptors
samples/synthetic/       Fictional Patient, Observations, Organization and Bundle
docs/architecture.md     Boundaries, rendering direction and limitations
docs/development.md      Manual validation and smoke-check checklist
AGENTS.md                Repository development conventions
```

## Prerequisites

- Node.js 22 LTS, version 22.13 or newer, and npm 10 or newer.
- A modern browser for web. No backend, secrets, or environment variables are required.
- For a physical device: an Expo Go installation that supports SDK 55, with the device
  and development computer on a reachable network. Native toolchains are not required
  for web or compatible Expo Go use.

## Start locally (PowerShell)

Run from this repository, whose current local folder is `fhir-native`:

```powershell
Set-Location 'C:\workspace\active-projects\fhir-native'
npm install
npm test
npm run typecheck
npm run lint
npm run web
```

`web` starts Expo's development server and opens the browser. Stop it with Ctrl+C.
Open a measurement to see its summary and optionally its original FHIR record. The
Organization record demonstrates the generic fallback.

For a physical device, stop the web server and run:

```powershell
npm run start -- --go
```

Scan the QR code with compatible Expo Go (Android) or the camera (iOS). A current
store version of Expo Go may no longer include SDK 55; check
[Expo Go downloads](https://expo.dev/go?sdkVersion=55&platform=android&device=true).
On iOS, where installing older Expo Go versions on physical devices is restricted,
use web until a compatible client or development build is available. Native builds
are outside Phase 0.

## Dependency baseline and validation status

The manifests follow the official stable SDK 55 template: Expo `~55.0.31`, React and
React DOM `19.2.0`, React Native `0.83.10`, and React Native Web `~0.21.0`. Router and
native support libraries follow the SDK 55 bundled dependency map. References:
[SDK 55 template](https://github.com/expo/expo/blob/sdk-55/templates/expo-template-default/package.json),
[bundled versions](https://github.com/expo/expo/blob/sdk-55/packages/expo/bundledNativeModules.json),
[Expo monorepos](https://docs.expo.dev/guides/monorepos/).
This is a documented stable baseline, not a claim to use the newest SDK.

The maintainer validated Phase 0.1 (commit `ab570f5`): web startup, 46/46 tests,
TypeScript, ESLint, Prettier and Expo Doctor (20/20) passed. Phase 0.2 documents the
35-finding audit snapshot and remediation constraints in the
[dependency security assessment](docs/security/dependency-audit.md). The five underlying
advisories remain unresolved; no dependency changes or new validation were performed.

Phase 0.1 adds Vitest for focused, deterministic shared-package tests. `npm test` runs once
in Node without watch mode, Expo, a browser or UI mocks. Tests cover Patient identity and
missing demographics, Observation results/components/time/status, conservative fallbacks,
unresolved profiles and source preservation. See [development](docs/development.md) for
the complete manual validation sequence. These checks were not rerun during Phase 0.2.

The committed root `package-lock.json` captures the validated dependency baseline.
Use `npm ci` for a clean installation. Future manifest changes require `npm install`
and review of the generated lockfile diff before committing.

FHIR definitions come from `@types/fhir` via its explicit `fhir/r4` entry point.
Types are not runtime schema or profile validation. There is no server, persistence,
authentication, terminology service, FHIRPath, or profile resolver yet.

The renderer labels `effectiveDateTime` as clinically effective time, preserving its
precision and timezone. Supplied unsupported results (including component values) use
generic fallback instead of being called unavailable; the original data is retained.
Absent results can show a supplied absence reason. Supported result forms remain limited
to quantities, supplied coded displays, strings, booleans and integers.

See [architecture](docs/architecture.md) for boundaries and limitations. A possible
next milestone is a small read-only StructureDefinition experiment
using curated R4 profiles.
