# Development and manual validation

This phase was implemented as source only. No installation, app execution, type checking,
linting, formatting checks, builds, or tests were executed. These steps are for the maintainer.

## First installation

```powershell
Set-Location 'C:\workspace\active-projects\fhir-native'
npm install
npm run typecheck
npm run lint
npm run format
npm run format:check
Push-Location apps/patient
npx expo install --check
npx expo-doctor@latest
Pop-Location
```

Review the lockfile and source formatting diff. All workspace type checks use no-emit
TypeScript. The shared packages use a portable ES2022 configuration; the application
extends Expo's TypeScript configuration with the same strictness controls.

Versions were selected from Expo's SDK 55 template and bundled native module map,
not resolved locally. Verify that the registry resolves `@types/fhir` with its `fhir/r4`
entry point, compatible TypeScript/ESLint tooling, and the selected Expo package patches.
If Expo reports version mismatches, review its expected versions, then explicitly align
the app dependencies from `apps/patient` using `npx expo install --fix`. Re-run the above
checks after adjustments. Do not independently upgrade React or React Native.
Avoid `--force` or `--legacy-peer-deps` as a substitute for resolving compatibility.

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

Add targeted renderer tests for absent fields, zero/false, partial dates, quantity
comparators, missing coded displays, unsupported value types, cancelled/error statuses,
modifier extensions, unresolved profiles, and preservation of source properties. Then
explore a minimal read-only StructureDefinition flow with curated synthetic R4 examples.
No automated test runner or suite is configured in Phase 0.
