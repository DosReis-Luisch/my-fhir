# MyFHIR development rules

## Scope and boundaries

- Work inside this repository only. Keep changes small and purposeful.
- FHIR R4 is the native clinical data model. Import R4 definitions through
  `@myfhir/fhir-core`; do not introduce proprietary clinical DTOs or copy the FHIR spec.
- Keep `fhir-core` and `fhir-renderer` independent of React, React Native, Expo,
  browser/Node APIs and application/sample modules.
- The application owns UI and navigation. The renderer owns interpretation and
  disposable presentation descriptors. Source resources must remain intact and unmutated.
- Preserve unknown fields/extensions, distinguish unavailable values from clinical
  interpretations, and fall back when modifier semantics are unsupported.
- Never imply profile validation, terminology resolution, normality, or universal FHIR
  support unless actually implemented and validated.
- Use synthetic data only. Never add credentials, patient exports or production data.

## Conventions

- npm workspaces; use package-name imports and explicit workspace dependencies.
- Keep one compatible Expo/React/React Native dependency family. Follow the selected
  SDK's official versions and standard Metro behavior; avoid speculative infrastructure.
- Use strict TypeScript, small modules, type-only imports, ESLint flat config and Prettier.
- No generated native directories, build output, node_modules, or .expo files in Git.
  The root package-lock.json should be committed after the maintainer installs successfully.
- Follow the root README and docs/architecture.md when changing architectural boundaries.

## Execution and validation

- Do not run any .NET/MSBuild/vstest commands unless explicitly requested in the current
  prompt. There is no .NET project in this phase.
- When a request is source-only, do not install dependencies, launch Expo, build, run
  Docker or execute tests/validation. Report what was not run and provide manual commands.
- npm commands are only appropriate for relevant frontend work. Never start a long-running
  watch/dev server on the user's behalf unless explicitly authorized for that task.
- When validation is authorized, use `npm run typecheck`, `npm run lint`, and
  `npm run format:check`; run Expo dependency checks from `apps/patient` when relevant.
  Use docs/development.md for manual web/device smoke checks.
- Do not create commits, push branches, or open pull requests unless requested.
