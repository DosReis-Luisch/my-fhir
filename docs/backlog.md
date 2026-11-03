# Product backlog

This is a provider-neutral roadmap, not a claim that planned controls or integrations exist.
See [integration architecture](integration-architecture.md) for identity, authorization,
acquisition and lifecycle boundaries, [architecture](architecture.md) for implemented engine
behavior and [development](development.md) for historical validation and manual checks.

The [3 November 2026 SDK 57 security baseline](security/dependency-audit.md#sdk-57-security-baseline--3-november-2026)
records 27 reported vulnerable dependency entries (five high), or 16 (five high) with
`--omit=dev`; these inherited counts do not establish application-runtime exposure.
Findings remain unresolved; automatic fixes and blanket overrides are not approved.
Its monitoring and reassessment prerequisites apply before external connections, real
patient data or production distribution. The historical Phase 0.2 assessment is preserved.

## Completed milestones: Phase 0 through Phase 2A

Completion describes delivered scope, not production certification. Historical validation
results are not rerun results for this milestone. Phase 3A/3B validation and the Phase 3C
merge are recorded below; web/iPhone runtime verification remains outstanding.

| Milestone | Goal / delivered scope                                                                   | Main dependencies                                 | Acceptance / remaining limits                                                                              | Current status                                                                                |
| --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Phase 0   | Establish Expo app, portable R4 core/renderer and synthetic Patient/Observation records. | Native R4 types and workspace boundaries.         | Selected summaries and original-resource inspection; other types use generic fallback.                     | Delivered baseline; no real data or integration.                                              |
| Phase 0.1 | Harden interpretation and add focused shared-package tests.                              | Phase 0.                                          | Preserve zero/false, unsupported values, modifier/error fallbacks and time precision without mutation.     | Completed; maintainer's historical 46-test/check results are in README.                       |
| Phase 0.2 | Assess dependency security and document remediation constraints.                         | Baseline dependency tree.                         | Record findings and limitations without claiming fixes.                                                    | Completed assessment; unresolved findings remain a maintenance prerequisite.                  |
| Phase 1A  | Inspect StructureDefinition snapshots and match declared profiles in memory.             | Portable core.                                    | Distinguish resolved, ambiguous and missing definitions; never imply validation.                           | Completed and merged.                                                                         |
| Phase 1B  | Add opt-in profile-informed presentation metadata.                                       | Phase 1A and conservative renderer fallback.      | Limited safe field hints; preserve source and non-validation semantics.                                    | Completed and merged.                                                                         |
| Phase 1C  | Expose an isolated visual profile inspector.                                             | Phase 1B.                                         | Display returned metadata/notices without adding profile logic to UI or altering wallet records.           | Completed and merged.                                                                         |
| Phase 1D  | Align the patient app with the SDK 57 dependency family.                                 | Phase 1C and compatible Expo/native dependencies. | Dependency alignment and manual validation tracked in development notes; no native-health support implied. | SDK 57 upgrade merged; historical preparation notes are not new validation results.           |
| Phase 2A  | Provide Home, Records and Me wallet navigation over existing synthetic data.             | SDK 57 baseline and existing renderer.            | Tab/detail/direct-link navigation, readable safe areas and original-resource access.                       | Merged into main (`b4778cd`); final device navigation verification remains a follow-up check. |

Phase 2A follow-up: use the existing development checklist to verify iPhone swipe-back,
Android Back, tab-origin return, direct-link fallbacks, rotation and enlarged text on a
compatible device/client. Record results separately; merged does not mean device-verified.

## Future milestones in priority order

The order below is product priority, not permission to skip security prerequisites. Each
first slice is deliberately bounded; broader support requires its own acceptance review.
All implementation uses synthetic data until the real-data gate below is satisfied.

### 1. Integration architecture and identity boundaries

- **Goal:** Separate account identity, proofing, source Patient context and access grants;
  describe independent acquisition routes and portable-engine boundaries.
- **Dependencies:** Existing architecture and product direction; provider-neutral findings.
- **Acceptance:** Document all four relationships, per-request/related-resource enforcement,
  provenance, lifecycle requirements and unresolved choices; link architecture and backlog.
- **Status:** Documented in this milestone; implementation and provider decisions deferred.

### 2. Safe FHIR acquisition and source identity (Phase 3A)

- **Goal:** First implement a pure in-memory boundary for one synthetic Patient/Observation
  pair, without file picking, networking, persistence or authentication.
- **Dependencies:** Item 1; explicit supported-input/check policy and source-qualified context.
- **Acceptance:** Preserve originals/unknown fields; distinguish source/type/ID/available
  version; keep same IDs from different sources/types distinct; repeat acquisition is
  idempotent; reject/hold malformed or ambiguous patient associations with explicit reasons.
  Add focused synthetic tests and accurately state validation limits. Context checks here
  enforce import consistency, not a substitute for server authorization.
- **Status:** Phase 3A implemented and maintainer-validated: installation completed,
  **163 tests passed**, TypeScript and lint passed, and formatting passed using
  `--end-of-line auto`. These are Phase 3A baseline results, not Phase 3B results.
  The in-memory store exposes `acquire` and `records`,
  preserves immutable native-resource snapshots with separate metadata, checks exact relative
  Patient references in an explicit source context, and reports duplicates/rejections/content
  conflicts without overwriting or selecting a latest version. Basic JSON/shape guards do
  not establish FHIR conformance or authorization; there is no renderer/UI integration.
  See [implemented boundary and limits](architecture.md#source-aware-synthetic-acquisition-phase-3a).

### 3. Longitudinal FHIR Observation engine (Phase 3B)

- **Goal:** Extract one supported coded Quantity series as portable, disposable analysis.
- **Dependencies:** Item 2; patient/source context and time/unit policy.
- **Acceptance:** Isolate patients, retain source references, preserve effective-time
  precision and status; separate incompatible codes/units, handle missing/unsupported values
  explicitly and avoid normality or treatment inference. Cover deterministic synthetic cases.
- **Status:** Phase 3B merged via **PR #9**. Maintainer reports **224 tests passed**,
  TypeScript and ESLint passed, and Prettier passed with `--end-of-line auto`.
  One exact coding/coded-unit Quantity series, final status only, explicit
  source/patient context, complete effective timestamps and retained acquisition references.
  Unsupported units/forms/contexts/modifiers and ambiguous revisions are explicitly excluded;
  no unit conversion, latest-version inference, clinical conclusions, charts or UI wiring.
  See [implemented policy and limits](architecture.md#longitudinal-coded-quantity-analysis-phase-3b).
  Synthetic tests cover historical sorting, isolation, exclusions, revisions and preservation.
  These baseline results are not Phase 3C validation.

### 4. Trends and graphs (Phase 3C)

- **Goal:** Render one engine-produced series with a selectable time range and accessible
  values; keep clinical grouping out of UI.
- **Dependencies:** Item 3 and a small chart/accessibility decision.
- **Acceptance:** Correct time/unit labels, empty/gap states, original-record navigation,
  readable narrow/large-text layouts and equivalent accessible values; no invented points,
  silently joined incompatible data or inferred normality.
- **Status:** Phase 3C merged through **PR #10**, commit `15408b1`. The maintainer
  previously reported **234 tests passed**, TypeScript, ESLint, Prettier and Expo Doctor
  passed. These are historical results, not Phase 4A validation. Web/iPhone runtime
  verification remains outstanding, including chart layout, VoiceOver, range switching,
  record-detail/direct-link navigation and the web console warning fix.
  Trends tab uses ten separate fictional body-weight Observations through acquisition and
  longitudinal analysis, without modifying dashboard fixtures/Bundle or engine behavior.
  1M/6M/1Y/All ranges use calendar windows anchored to the latest engine point; SVG uses
  actual time spacing and stable zero-based kg scaling. An accessible chronological list
  links to source/type/ID/version-qualified original record details, including raw JSON.
  See [implementation and limitations](architecture.md#first-body-weight-trends-screen-phase-3c-merged-runtime-verification-pending).
  Expo 57.0.31, Router 57.0.29 and `react-native-svg` 15.15.4 are retained in the merged
  dependency baseline. No checks were rerun for this documentation update. More measurements,
  interactive chart features and clinical interpretation remain outside this slice.

### 4A. Clinical catalog and organization

- **Goal:** Share disposable source/patient-scoped organization between Records and Trends.
- **Dependencies:** Existing acquisition, conservative renderer and longitudinal engines;
  Phase 3C merged before implementation.
- **Status:** Phase 4A merged through **PR #11**, commit `af1a7c2`, as
  `@myfhir/fhir-catalog`. Web/iPhone runtime checks remain outstanding; merge does not
  establish device verification. Exact supported Observation category coding groups vital
  signs, laboratory and other/unclassified records, with evidence and explicit limits.
  Patient descriptors retain context; clinical groups contain Observations only. Source,
  type, ID and available version remain distinct; no latest version is chosen.
  Records uses nonempty catalog groups/counts and qualified detail links. Trends uses
  catalog history labels/capabilities while preserving the engine series, chart and fixtures.
  Supplied references remain unresolved; no traversal or fetching is implemented.
- **Acceptance / remaining work:** Complete web/iPhone grouped Records, qualified detail
  navigation, Trends and accessibility verification. No Phase 4A validation results are
  newly claimed here. No installs, tests, builds, formatters or Expo commands were run
  during Phase 4A implementation. Security reassessment gates above
  remain in force. See [catalog boundary](architecture.md#clinical-catalog-and-organization-phase-4a).
- **Deferred:** General search/filter UI, imaging/document acquisition, DICOM retrieval
  and viewing, general reference resolution, non-numerical timelines, clinical validation
  and laboratory interpretation. The narrow report/result slice is tracked below.

### 4B. Laboratory results and DiagnosticReports

- **Goal:** One fully fictional laboratory report and two independently discoverable results,
  with exact local source/patient-scoped links and original FHIR inspection.
- **Dependencies:** Merged Phase 4A; native R4 DiagnosticReport export, acquisition guards,
  catalog classification/resolution and conservative renderer metadata presentation.
- **Status:** Phase 4B merged through **PR #12**, commit `543d718`. Web/iPhone runtime
  acceptance remains unverified; merge does not establish device acceptance. The Phase 4B
  boundary supports Patient, Observation and DiagnosticReport. A report uses exact unversioned `v2-0074|LAB` category
  coding, independently of Observation laboratory coding. Reports, results and unclassified
  records have separate populated groups. No report category is inherited by its results.
- **Relationships:** Only direct `DiagnosticReport.result` references of the exact form
  `Observation/<logical-id>` can resolve to already supplied acquired records. Source,
  patient and all retained target versions are checked without choosing a latest version.
  Missing, foreign, ambiguous, multiple-version, unsafe and unsupported assertions remain
  explicit; no traversal or fetching occurs. Duplicate assertions do not create records.
- **Presentation:** Final reports with supported metadata show title/status and separate
  supplied clinical/issued times. Other statuses, modifier extensions and unsupported
  narratives/conclusions/attachments/time forms fall back. Result links are supplied-reference
  navigation, not approval of the report or clinical interpretation of its results.
- **Validation / remaining work:** Complete web/iPhone grouped Records, report/result
  navigation, original JSON, accessibility and unchanged Trends checks. No new automated
  validation results are claimed here. No installs, tests, builds, Expo or formatters were
  run during Phase 4B implementation.
  No manifests, dependency versions, lockfile or security assessment were changed.
  See [Phase 4B boundary](architecture.md#laboratory-results-and-diagnosticreports-phase-4b).
- **Deferred:** Longitudinal laboratory histories; reference ranges/normality and safe clinical
  interpretation; presentedForm/PDF; DICOM retrieval/viewing; external reference resolution;
  authentication, authorization, verified provenance and protected storage. Existing SDK 57
  security findings remain unresolved and release gates remain in force.

### 4C. Imaging studies and radiology reports

- **Goal:** One fictional native ImagingStudy and one RAD DiagnosticReport with explicit
  local report/study links, metadata presentation and original source inspection.
- **Dependencies:** Phase 4B merge `543d718`; existing source-qualified acquisition, catalog,
  renderer and record-detail navigation. No new workspace or dependency is introduced.
- **Status:** Phase 4C merged through **PR #13**, commit `3edc865`. Web/iPhone runtime
  acceptance checks remain outstanding; no new validation results are claimed here.
  Basic ImagingStudy status/metadata/subject
  guards preserve immutable originals. Studies use explicit resource-type classification
  evidence; radiology reports require exact unversioned `v2-0074|RAD`. LAB and Observation
  rules remain intact. Modifier-bearing studies/reports remain visible as unclassified.
- **Relationships:** The existing resolver supports both report `result -> Observation` and
  `imagingStudy -> ImagingStudy`, with separate kinds/paths, exact source/patient matching,
  complete retained-version ambiguity checks and explicit unresolved reasons. No latest
  version, recursive traversal, external fetch or authorization is inferred. Study-to-report
  navigation uses already resolved inbound catalog evidence, not another resolver.
- **Presentation:** Study description/status/start/identifiers, reported counts, listed
  metadata counts, raw supported modality coding and supplied Series/SOP Instance UIDs.
  Registered/available metadata does not prove a completed examination or available pixels.
  RAD reports retain final-status and unsupported-content fallbacks. No thumbnails, image
  data, findings interpretation or numerical imaging history is implemented.
- **Validation / remaining work:** Verify
  web/iPhone Records counts, both navigation directions, unresolved links, original JSON,
  separate timestamps, accessibility and unchanged Trends. No installs, tests, builds,
  Expo or formatters were run. Manifests, lockfile and SDK 57 security findings are unchanged.
  See [Phase 4C boundary](architecture.md#imaging-studies-and-radiology-reports-phase-4c).
- **Deferred / release gates:** Authorized DICOMweb QIDO-RS/WADO-RS, external authenticated
  retrieval, large payload/caching policies, patient authorization, secure storage/privacy,
  PDF/document viewing and imaging timelines. No production or real-data approval is implied.

### 4D. Recorded Conditions, problems and diagnoses

- **Goal:** Two distinct fictional Condition assertions: a problem-list entry and an
  encounter diagnosis, without establishing their medical correctness.
- **Dependencies:** Phase 4C merge `3edc865`; native R4 types, acquisition, catalog,
  conservative renderer and source-qualified Records/detail routes.
- **Status:** Implemented in source on `feat/conditions`, **awaiting maintainer validation
  and GitHub review; not complete**. Condition acquisition keeps code optional, applies
  selected shape/subject guards and preserves original fields, identity, version and conflicts.
  Exact unversioned condition-category coding groups problem-list-item, encounter-diagnosis
  and other/unclassified Conditions. No diagnosis/category is inferred from text or results.
- **Status semantics:** Clinical and verification statuses are independent exact selections
  with frozen evidence; missing/conflicting/unsupported/versioned codings remain unavailable.
  Provisional never becomes confirmed; confirmed means source-supplied, not independently
  validated. Selected problem-list/entered-in-error/abatement consistency checks produce
  explicit limitations and safe renderer fallback, not full FHIR validation or repair.
- **Presentation / references:** Recorded date, onset and abatement stay separate source
  strings. Unsupported choices, refuted/error, missing/conflicting metadata and modifiers
  fall back to preserved originals. Subject/Encounter/recorder/asserter/evidence/stage
  references remain unresolved; no Encounter is invented and no clinical evidence interpreted.
- **Validation / remaining work:** Focused core/acquisition/catalog/renderer/application
  tests, full suite, TypeScript, lint, `npm run format:check`, then web/iPhone grouped
  Records/status labels, qualified links, original JSON, Back and accessibility. Preserve
  prior laboratory/imaging relationships and ten-point weight ranges. No installs, tests,
  builds, Expo or formatters were run. See [Condition boundary](architecture.md#recorded-conditions-problems-and-diagnoses-phase-4d).
- **Deferred / gates:** No condition timelines, current-problem reconciliation, latest-version
  selection, diagnosis inference, terminology APIs, clinical decision support, networking,
  storage or authorization. Existing security findings and real-data/release gates remain.

### 5. Local FHIR R4 file and Bundle import

- **Goal:** Preview and import one bounded synthetic JSON resource or collection Bundle.
- **Dependencies:** Item 2; file-access decision, input limits and patient/source review UX.
- **Acceptance:** Show accepted/rejected/held entries before import, preserve originals and
  scoped references, detect repeats, handle missing/mixed patient associations explicitly;
  never execute transactions, narratives or automatically fetched links. Cancel leaves no
  partial import. General Bundle-type support is a later slice.
- **Status:** Planned; imports do not establish remote ownership or authorization.

### 6. Apple HealthKit integration

- **Goal:** Map one supported read-only sample category into native R4 through an iOS adapter.
- **Dependencies:** Item 2, native development-build/entitlement decision, privacy/storage
  readiness and a reviewed sample-to-FHIR mapping.
- **Acceptance:** Synthetic/test samples only initially; denial/revocation handled; retain
  sample identity, units/time, device origin and mapping provenance; repeat reads do not
  duplicate records. No health binding or platform API enters the portable engines.
- **Status:** Planned; native support and permission UX are not implemented.

### 7. Android Health Connect integration

- **Goal:** Map one supported read-only sample category through an Android adapter.
- **Dependencies:** Item 2, native development-build/platform-permission decision,
  privacy/storage readiness and a reviewed mapping.
- **Acceptance:** Synthetic/test samples initially; unsupported platform and permission
  denial/revocation states work; preserve origin, sample identity, units/time and mapping;
  repeat acquisition is idempotent and cannot mix patient contexts.
- **Status:** Planned; independent of the Apple adapter and outside portable engines.

### 8. Authorized SMART or provider-gateway proof of concept

- **Goal:** Read one synthetic Patient and Observation from an explicitly approved sandbox
  using one supported connection approach; do not implement both in the first slice.
- **Dependencies:** Item 2; provider approval, test identities, binding/grant contract,
  token custody/lifecycle and backend enforcement/audit design. SMART availability must
  be demonstrated; a provider gateway is an independent option.
- **Acceptance:** Approved account can read its bound synthetic patient; arbitrary patient
  IDs, unbound identities and revoked grants fail. Direct reads, searches and any enabled
  related/continuation paths retain scope. No app secrets on the phone or clinical payloads
  in routine logs. Unsupported routes remain unavailable; disconnect stops acquisition.
- **Status:** Planned, synthetic sandbox only; no provider approval or OAuth grants assumed.

### 9. Multi-patient caregiver access

- **Goal:** Switch between two independently approved synthetic patient contexts, initially
  read-only; distinguish guardian authority from delegated caregiver permission.
- **Dependencies:** Items 1, 2 and a demonstrated authorization boundary such as item 8;
  authority evidence, grant validity/revocation and age-transition policy.
- **Acceptance:** Unauthorized contexts cannot be selected/accessed; switching cancels or
  isolates in-flight work and caches, records, imports and trends remain patient-scoped.
  Revocation/expiry works and decisions are auditable; family labels do not grant access.
- **Status:** Planned; no fake permission toggles or frontend-only enforcement.

### 10. Additional FHIR resource rendering

- **Goal:** Add Immunization first, then separate slices for medication resources,
  DiagnosticReport and document metadata/content handling.
- **Dependencies:** Existing renderer safety contract, synthetic fixtures and explicit
  supported fields/status/reference policy for each resource type.
- **Acceptance:** Each slice preserves originals/unknown fields and modifier fallbacks,
  states unavailable/unsupported values honestly and has focused tests. Medication intent
  is not conflated with administration; reports retain links to results; document retrieval
  and content safety are separate from metadata rendering. No universal support claim.
- **Status:** Planned; unsupported types currently retain generic fallback.

### 11. Professional workspace and controlled writes

- **Goal:** Start with one read-only verified-professional workflow; consider one reviewed
  write action only as a later, independently approved slice.
- **Dependencies:** Verified professional identity, patient/task-specific grants, privacy,
  audit and source integration; writes additionally require validation, source concurrency
  rules, review and explicit permission.
- **Acceptance:** A role label never grants arbitrary patient access or write permission.
  Read access is scoped; any later write has confirmation/review, provenance, audit and
  conflict handling, with expired/revoked authority rejected.
- **Status:** Deferred; no clinical writes are implemented or authorized by this roadmap.

### 12. Visual identity redesign

- **Goal:** Refresh one wallet surface first, then extend an approved accessible design.
- **Dependencies:** Stable wallet interaction, identity/context labels and design approval.
- **Acceptance:** Preserve synthetic/permission/clinical-limit notices, context visibility,
  navigation and readable source details; verify contrast, large text and narrow devices.
  No engine or resource changes for branding.
- **Status:** Deferred; separate from integration and clinical interpretation.

## Real-data gate and deliberately deferred decisions

Before any real external patient data or real native health samples, require verified identity
and source-approved authorization appropriate to the source, per-request enforcement, protected
transport/storage, token lifecycle, privacy/retention policy, revocation and access auditing.
Device permission alone does not establish entitlement to provider records. Reassess dependency
security and runtime input handling before that release. Sandbox success is not production approval.

Choose assurance/proofing and binding authority with providers. Defer identity-provider choice,
backend necessity, storage/encryption/key custody, offline access, retention/deletion, downloaded
copies after revocation, synchronization protocol and conflict resolution until requirements are
agreed. Later persistence/sync work needs explicit acceptance for account/patient isolation,
device loss, connection removal, version conflicts and deletion propagation; it is not implicitly
included in acquisition or file import. No persistent schema or infrastructure is selected here.
