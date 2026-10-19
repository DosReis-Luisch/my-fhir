# Development and manual validation

The Phase 1A starting point is `main` at the Phase 0.2 merge (`de29133`). The maintainer
reports 46 tests passing and successful TypeScript, ESLint, Prettier and Expo Doctor
checks for the prior baseline. Phase 1A is source-only: no installation, tests, builds,
app execution or automated validation were performed. The commands below are for the
maintainer; no dependencies or lockfile changes are needed for these APIs/tests.

## Validate Phase 1A

```powershell
Set-Location 'C:\workspace\active-projects\fhir-native'
npm test
npm run typecheck
npm run lint
npm run format:check
Push-Location apps/patient
npx expo install --check
npx expo-doctor@latest
Pop-Location
```

If dependencies are not already installed, run `npm ci` locally using the committed
lockfile before these checks. If formatting needs adjustment, format only changed files
with Prettier and repeat `npm run format:check`.

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
# Core metadata/profile matching tests only:
npm test -- packages/fhir-core
```

Tests cover name preference and missing demographics; quantity zero/comparators;
boolean false; blood-pressure components; absence reasons; unsupported value choices
and unsummarizable values; clinically effective time precision/timezone; cancelled/error
statuses; unsupported/unknown resource dispatch; modifier extensions; unresolved profiles;
and retention of original resources, extensions and unknown properties. All fixtures are
small, deterministic, fictional resources defined alongside the tests.

Phase 1A adds `packages/fhir-core/tests/profiles.test.ts` without changing the existing
46 test cases. New cases cover metadata/cardinalities, repeated paths and slices, missing
optional fields, absent/empty snapshots, exact canonical/version matching, missing and
ambiguous candidates, wrong resource type/kind, unsupported canonical forms, non-validation
semantics, detached immutable output and non-mutation of inputs. No browser, network,
Expo or backend is needed for these tests.

## Public API example (no UI integration)

```typescript
import { inspectStructureDefinition, matchDeclaredProfiles } from '@myfhir/fhir-core';
import { syntheticPulseObservation, syntheticPulseProfile } from '@myfhir/synthetic';

const inspection = inspectStructureDefinition(syntheticPulseProfile);
if (inspection.status === 'available') {
  // Read metadata only: no conformance checks or slicing interpretation.
  const elements = inspection.elements;
}
const matches = matchDeclaredProfiles(syntheticPulseObservation, [syntheticPulseProfile]);
// matches[0].status is resolved, but validation is always not-performed.
```

The example exports are separate from the patient overview's `resources` and `bundle`.
The curated snapshot is a native R4-shaped inspection fixture, not a complete generated
Observation snapshot. No full FHIR validator has been run on it. See
[architecture](architecture.md#structuredefinition-inspection-phase-1a) for result types
and matching policy.

## Maintenance concern

The five advisory families from the Phase 0.2
[security assessment](security/dependency-audit.md) remain unresolved. They were not
re-audited in Phase 1A. No dependency changes or security remediation were attempted.

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

Run and review Phase 1A checks before committing. Runtime FHIR/profile validation and
support for the remaining Observation value types are still absent. Profile-driven
presentation, snapshot generation and reference resolution remain separate later work.
