# Development and manual validation

## Phase 2A wallet routes and manual checks

Source implementation starts from SDK 57 merge `1943722` on
`feat/patient-wallet-phase-2a`. The repository has 109 existing tests; none was executed
in this milestone. Dependencies, lockfile, synthetic data and portable engine packages
are unchanged. No installation, formatter, automated validation, Expo or native build was run.

| URL                   | Area                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `/`                   | Home tab: compact Patient context and a two-measurement demo snapshot                         |
| `/records`            | Records tab: compact Patient context, all demo Observations and separate Organization context |
| `/me`                 | Me tab: synthetic FHIR Patient information, not an authenticated account                      |
| `/record/[id]`        | Existing record detail outside the tabs                                                       |
| `/profile-inspection` | Existing read-only developer/demo inspector outside the tabs                                  |

Home moved to `app/(wallet)/index.tsx`; there is no second root index route. The normal
Expo Router Tabs handle navigation without a custom tab implementation or new icon package.
Home and Me have separately labelled developer links. Existing native resources and renderer
values are reused; no complete-history timeline, clinical trends or normality are inferred.
Home selects two observations in fixed demo order without implying recency. Records retains
all available demo observations; Me is the primary full Patient summary. Repeated patient
names, snapshot measurements and record-detail links keep the viewing context explicit.

Run from the repository root in Windows PowerShell:

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
npm run web
```

Stop web with Ctrl+C. For a physical iPhone or Android device with a compatible SDK 57
Expo Go client, run `npm run start -- --go` and scan the QR code on a reachable network.
If the available client does not support SDK 57, use the existing compatible development
build workflow or web; do not change SDK versions to satisfy the store client. Future native
health integrations will require a custom build; they are not present in this wallet.

Web/mobile smoke checklist (not executed):

- Check all three labelled tabs, touch targets, keyboard focus and screen-reader labels.
  Directly open and reload `/`, `/records`, `/me` and `/profile-inspection` on web.
- On Home, confirm a compact Patient heading and only the blood pressure 118/76 mmHg and
  heart rate 68 beats/min snapshot. Follow the Records link to all three observations,
  including weight 72.4 kg. Home and Records must not repeat the full Patient demographics
  card; Me retains it. Inspect component labels and original values in record details;
  no additional measurements, recency or normality claims should appear.
- Open records from Home, Records and Me; Back should return to the originating tab.
  Check iPhone swipe-back/Android Back, and directly open a known detail URL such as
  `/record/demo-heart-rate`. With no navigation history, Back falls back to `/records`.
  Confirm `/record/does-not-exist` remains a readable missing-record state.
- In Records, keep Organization context distinct from clinical Observations. Its generic
  fallback notices must remain legible and its existing detail route accessible.
- In Me, check only renderer-supplied Patient attributes and the explicit synthetic context.
  There must be no sign-in, connection, sharing, role or fake authorization controls.
- Open the inspector from Home and Me. Check its non-validation boundary, hints and notices.
  Back uses history; a direct inspector link with no history falls back to `/me`.
- On a narrow phone, rotate and increase system font size. Scroll to the final card/footer;
  neither tab labels nor content may overlap the home indicator or status bar. Long values,
  resource identifiers and source JSON must wrap. Check larger web/tablet widths as well.
- Expand/collapse original FHIR source and inspector notices. Confirm they remain selectable
  and unchanged, with clinical fallback warnings readable at enlarged text sizes.

Page's `inTabs` setting removes only the bottom safe-area edge on tab pages; the navigator
owns that inset. No fixed/absolute tab-bar positioning or hard-coded device inset was added.
Layout and native navigation still require these maintainer checks. See
[product direction](product-direction.md) for future identity, authorization and ingestion work.

The migration notes and validation records below are historical; use the Phase 2A route
and smoke checklist above for this milestone.

## SDK 57 preparation and dependency alignment (Phase 1D, step 2)

Starting from Phase 1C merge `206f6dc` on `chore/expo-sdk-57-upgrade`, the manifests
now target SDK 57. The maintainer's SDK 56 installation/lockfile changes were preserved.
SDK 56 results: 109/109 tests, TypeScript and ESLint passed; font deduplicated to `56.0.7`;
TypeScript `6.0.3` and typescript-eslint `8.71.2` installed; Expo Doctor **20/22**;
audit snapshot **29 findings**. Unrelated formatting differences remain pending. None of
these results establishes SDK 57 compatibility, and no new validation has been executed.

App versions follow the official [SDK 57 template](https://github.com/expo/expo/blob/sdk-57/templates/expo-template-default/package.json)
and [bundled mapping](https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json):
Expo `~57.0.30`, React/React DOM `19.2.3`, React Native `0.86.3`, Router `~57.0.28`,
Metro runtime `~57.0.17`, constants `~57.0.22`, font `~57.0.4`, linking `~57.0.13`,
and status bar `~57.0.1`. React Native Web `~0.21.0`, safe-area context `~5.7.0`,
screens `~4.26.0`, React types `~19.2.2` and root TypeScript `~6.0.3` remain unchanged.
The maintainer's root typescript-eslint range `^8.58.0` is preserved.

### Why root peers need alignment

The SDK 56 lockfile provides concrete dependency edges:

- Router `56.2.21` depends on drawer-layout `4.2.12`, which requires Reanimated
  `>=2.0.0` and Gesture Handler `>=2.0.0` as non-optional peers. Router itself marks
  these peers optional; that does not remove the drawer package's requirements.
- npm selected peer-installed Reanimated `4.7.1` and Gesture Handler `3.4.0` at the
  root. Reanimated requires Worklets `0.13.x` and RN `0.86 - 0.88`; Worklets `0.13.0`
  has the same RN range. Root RN `0.88.0` then requires React `^19.3.0`, consistent
  with the root peer-installed React `19.3.1`. App-local RN `0.85.3` and React `19.2.3`
  remained separate. Root peer packages cannot resolve dependencies down inside the app.
- Expo UI's optional Worklets `*` peer is another unconstrained consumer. Meanwhile,
  modules-core `56.0.27` allows only Worklets `^0.7.4 || ^0.8.0`, so the installed
  `0.13.0` is incompatible. Root React/RN packages carry the lockfile's `peer: true`
  marker. These edges strongly explain the drift; the lockfile alone does not establish
  npm's precise selection order or every contributing peer consumer.

The app now explicitly depends on SDK-mapped Reanimated **4.5.1**, Worklets **0.10.1**
and Gesture Handler **~2.32.0**, rather than leaving native peer selection to broad ranges.
These are compatibility declarations, not new UI features. SDK 57
[modules-core](https://github.com/expo/expo/blob/sdk-57/packages/expo-modules-core/package.json)
accepts Worklets `^0.10.0`; the template selects the exact same trio.

The root has matching **devDependencies** for React, React DOM, React Native and that
native trio. These explicit anchors constrain hoisted tooling/peer consumers to the same
SDK family instead of leaving the root free to select latest compatible peers independently
of the app. They do not add React imports or runtime dependencies to the FHIR workspaces.
Keep the six root/app declarations synchronized in future migrations. No overrides,
force/legacy-peer-deps flags or warning suppressions were introduced. The obsolete SDK 55
font override remains removed.

### Maintainer installation and validation

The lockfile was not edited in this step and still captures the SDK 56 install. Run
`npm install` locally to regenerate it; do not discard the existing lockfile or use
`npm ci` while it disagrees with the manifests. Review the generated diff. The declarations
are intended to correct alignment, but final hoisting/deduplication cannot be confirmed
without installation. Preserve any installation warnings as evidence rather than bypassing them.

```powershell
npm install
npm ls expo expo-router expo-modules-core expo-font typescript typescript-eslint --all
npm ls react react-dom react-native --all
npm ls react-native-reanimated react-native-worklets react-native-gesture-handler --all
npm explain react
npm explain react-native
npm explain react-native-worklets
npm explain react-native-reanimated
npm test
npm run typecheck
npm run lint
npm run format:check
Push-Location apps/patient
npx expo install --check
npx expo-doctor@latest
Pop-Location
npm run web
```

Expect one physical React `19.2.3`, React Native `0.86.3`, Worklets `0.10.1` and
Reanimated `4.5.1`, with Gesture Handler in the `2.32.x` family and font in `57.0.x`.
Repeated `deduped` references are fine; separate installed copies or `invalid`/peer
warnings need investigation even if tests pass. If duplicates remain, stop and review
the tree and explanation output; do not add broad overrides, delete the lockfile or
suppress peers automatically.

Check overview, record navigation, direct-route reloads and `/profile-inspection` manually.
The [SDK 57 release notes](https://expo.dev/changelog/sdk-57) identify RN `0.86.3` as
including the Hermes V1 memory-regression fix; native behavior still needs separate
verification with a compatible SDK 57 client/build. No native directories, builds or UI
changes were made. Doctor is not yet confirmed passing, the security findings have not
been re-audited, and formatting remains a maintainer check after final installation.
Stop at SDK 57 preparation and review the maintainer's results before further changes.
The older milestone instructions below are historical; use this section during migration.

The Phase 1C starting point is the Phase 1B merge (`af9f4ab`), on the required
`feat/profile-inspector-phase-1c` branch. The maintainer reports 109 tests passing and
successful TypeScript, ESLint, Prettier and Expo Doctor (20/20) checks for that baseline.
Phase 1C is source-only: no installation, tests, builds,
app execution or automated validation were performed. The commands below are for the
maintainer; no dependencies or lockfile changes are needed for this screen.

## Validate Phase 1C

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

Phase 1B adds `packages/fhir-renderer/tests/profilePresentation.test.ts` while retaining
all 72 prior tests. Cases cover the real synthetic workspace example, unchanged base
presentation, both choice mappings, absent values, component/boolean non-mapping,
unresolved and version-mismatched profiles, multiple declarations and ambiguous candidates,
missing/empty snapshots, duplicate paths/IDs/types, slicing/modifiers, fallback priority,
input preservation and frozen detached hints. Synthetic workspace imports are test-only;
production renderer code depends only on fhir-core. The maintainer subsequently validated
these tests as part of the Phase 1B baseline. They were not rerun in Phase 1C.
Phase 1C introduces no new pure engine logic or UI test framework; existing tests remain
unchanged. UI behavior requires the manual checks below.

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

## Profile-informed presentation example (Phase 1B API)

```typescript
import { presentResourceWithProfiles } from '@myfhir/fhir-renderer';
import { syntheticPulseObservation, syntheticPulseProfile } from '@myfhir/synthetic';

const result = presentResourceWithProfiles(syntheticPulseObservation, [syntheticPulseProfile]);
// result.presentation retains the original labels, values, notices and source.
// result.profiles[0] is resolved; its snapshot metadata is available.
// result.fieldHints associates valueQuantity/effectiveDateTime with their choice elements.
// The Quantity hint includes short: 'Synthetic pulse rate as a quantity'.
// result.validation is always 'not-performed'.
```

Hints are optional metadata alongside the presentation, never replacement clinical facts.
Patient health-record cards remain profile-unaware; only the separate Phase 1C demo
displays profile metadata. Missing, ambiguous or
unsupported correspondences produce no hint and a limitation; they never create fields
or bypass a generic fallback. Multiple declarations suppress all field hints without
assigning precedence. For the complete selection policy, see
[architecture](architecture.md#opt-in-profile-informed-presentation-phase-1b).

## Visual profile inspection demo (Phase 1C)

Start web locally with `npm run web`, then use **Explore FHIR profile inspection (demo)**
below the overview's patient record cards, or open `/profile-inspection` directly.
Use **Back** to return to the previous wallet screen (or Me when opened without history).
This route is separate from `/record/[id]` and does
not add the pulse example or StructureDefinition to the patient overview/Bundle.

The screen calls the Phase 1B wrapper with `syntheticPulseObservation` and
`[syntheticPulseProfile]`. It shows the returned clinical title/fields without changing
labels or values, declarations and local match status, resolved definition metadata,
snapshot metadata availability, and only the returned field hints. Unresolved declarations
remain visible verbatim; canonical URL/version metadata is shown only from resolved
definitions or explicitly listed ambiguous candidates, not guessed by UI matching logic.

**Profile conformance has not been validated.** Declared, resolved and available are
separate concepts. Snapshot completeness, clinical validity, trusted terminology and
normality are not established. mustSupport is labelled profile metadata. No clinical forms,
external files, network fetching or new validation functionality are provided.

Key boundaries stay visible. Detailed engine limitations and base-renderer notices can
be expanded with **Show engine notices**. Base notices are explicitly identified as coming
from the profile-unaware renderer; its unresolved-profile message is not presented as
overriding the opt-in resolution results. Generic fallback warnings remain visible without
expansion. No filtered or rewritten notice strings are used.

### Manual browser and mobile smoke checks

- Open the demo via its overview link, reload the direct route, and return to the overview.
  Confirm patient measurements and existing record links are unchanged.
- Compare the Observation title, Result, Clinically effective time and Status with the
  renderer output. Confirm values and labels are preserved, not taken from profile text.
- Check the exact declaration, resolved canonical URL/business version, profile title/name
  and available snapshot metadata. Confirm the non-validation boundary stays prominent.
- Check each returned hint's source path, element path/ID, type code, short text and
  mustSupport flag. There must be no hint-derived clinical values or compliance indicator.
- Expand/collapse notices using mouse, touch and keyboard. Check button focus, meaningful
  headings, readable large text and screen-reader expanded state. Confirm base notices
  remain distinct from profile resolution results.
- Test narrow mobile widths and large font settings. Scroll to all sections; long canonical
  identifiers and paths must wrap within their sections and remain selectable. Check web
  and, when available, a physical device using the existing compatible Expo Go workflow.
- For empty/unsupported UI checks, temporarily change only the demo call locally: pass `[]`
  definitions, use an Observation copy without meta.profile, provide a definition without
  snapshot, or use a mismatched version. Check unresolved/no-profile/no-hint states without
  crashes. Duplicate a matching definition to inspect ambiguity. Try a cancelled Observation
  to verify visible fallback warnings and no field hints. Restore the normal call afterward.

These are maintainer checks, not executed results. The screen handles each returned
profile/hint independently and does not assume a first profile, a snapshot, two hints or
populated optional metadata. A missing optional value is labelled **Not supplied**.

## Maintenance concern

The five advisory families from the Phase 0.2
[security assessment](security/dependency-audit.md) remain unresolved. They were not
re-audited in Phase 1C. No dependency changes or security remediation were attempted.

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

Allow network access if prompted and use a client supporting the current SDK 57. Current
iOS store clients may require another SDK; use a compatible client or development build
without changing dependency versions just for the client. No native build or
emulator was attempted.

## Next milestone

Run and review Phase 1C checks before committing. Runtime FHIR/profile validation and
support for the remaining Observation value types are still absent. Wider profile-driven
rendering, patient-facing integration, snapshot generation and reference resolution remain
separate work.
