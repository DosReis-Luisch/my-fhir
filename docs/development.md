# Development and manual validation

The maintainer validated Phase 0 locally (commit `50dfc6d`): the web application,
TypeScript, ESLint, Prettier and Expo Doctor passed. Phase 0.1 is source-only: no
installation, tests, builds, app execution or automated validation were performed.
The commands below are for the maintainer.

## Install and validate Phase 0.1

```powershell
Set-Location 'C:\workspace\active-projects\fhir-native'
npm install
npm test
npm run typecheck
npm run lint
npm run format:check
Push-Location apps/patient
npx expo install --check
npx expo-doctor@latest
Pop-Location
```

`npm install` updates the existing lockfile for the new Vitest dependency; it was left
unchanged during source implementation. Review this diff before committing. Do not use
`npm ci` until package.json and package-lock.json agree. If formatting needs adjustment,
format only the changed files with Prettier and repeat `npm run format:check`.

All workspace type checks use no-emit TypeScript. The root typecheck command additionally
checks test files and the Vitest configuration through `tsconfig.tests.json`; tests stay
outside production `src` trees. The shared packages retain their portable configuration.

## Focused shared-package tests

Vitest 4 is a root development dependency. The configuration runs only
`packages/*/tests/**/*.test.ts` in Node, using real workspace imports and explicit test
API imports. No UI runner, browser environment, coverage plugin or fixture framework is
required. See the [Vitest guide](https://vitest.dev/guide/) for runner usage.

```powershell
npm test
# Renderer only, once (no watch server):
npm test -- packages/fhir-renderer
```

Tests cover name preference and missing demographics; quantity zero/comparators;
boolean false; blood-pressure components; absence reasons; unsupported value choices
and unsummarizable values; clinically effective time precision/timezone; cancelled/error
statuses; unsupported/unknown resource dispatch; modifier extensions; unresolved profiles;
and retention of original resources, extensions and unknown properties. All fixtures are
small, deterministic, fictional resources defined alongside the tests.

## Maintenance concern

The remaining npm audit findings from Phase 0 are unresolved. Their severity and scope
have not been rechecked during this source-only milestone. No unrelated dependency
upgrades or automatic vulnerability remediation were attempted. Review them separately;
do not use `npm audit fix --force` or change the Expo dependency family as part of this
renderer hardening task.

## Web smoke check

```powershell
npm run web
```

- Confirm MyFHIR branding and the synthetic-demo badge appear.
- Confirm Alex Morgan's identity, blood pressure (118 and 76 mmHg), heart rate
  (68 beats/min), and body weight (72.4 kg) appear without inferred normality labels.
- Open each record, return to the overview, and expand/collapse the original resource.
- Confirm the Patient's custom extension is present in the original record but does
  not become a clinical fact in the summary.
- Open the Organization: it must display an unsupported-summary notice and retain
  the original resource. Visit `/record/does-not-exist` to check the missing-record state.
- Check narrow mobile and wide browser widths, keyboard links/buttons, readable
  text at enlarged font settings, and deep-link reloads while the dev server runs.

Stop with Ctrl+C. For compatible Expo Go on a physical device:

```powershell
npm run start -- --go
```

Allow network access if prompted and use a client supporting SDK 55. Current iOS store
clients may require a newer SDK; web remains the Phase 0 baseline. No native build or
emulator was attempted.

## Next milestone

Run and review Phase 0.1 checks before committing. Runtime FHIR/profile validation and
support for the remaining Observation value types are still absent. A later milestone
may explore a minimal read-only StructureDefinition flow with curated synthetic examples.
