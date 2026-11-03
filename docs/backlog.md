# Product backlog

This is a provider-neutral roadmap, not a claim that planned controls or integrations exist.
See [integration architecture](integration-architecture.md) for identity, authorization,
acquisition and lifecycle boundaries, [architecture](architecture.md) for implemented engine
behavior and [development](development.md) for historical validation and manual checks.

## Completed milestones: Phase 0 through Phase 2A

Completion describes delivered scope, not production certification. Historical validation
results are not rerun results for this milestone. No new checks were executed for this
documentation change.

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

### 2. Safe FHIR acquisition and source identity

- **Goal:** First implement a pure in-memory boundary for one synthetic Patient/Observation
  pair, without file picking, networking, persistence or authentication.
- **Dependencies:** Item 1; explicit supported-input/check policy and source-qualified context.
- **Acceptance:** Preserve originals/unknown fields; distinguish source/type/ID/available
  version; keep same IDs from different sources/types distinct; repeat acquisition is
  idempotent; reject/hold malformed or ambiguous patient associations with explicit reasons.
  Add focused synthetic tests and accurately state validation limits. Context checks here
  enforce import consistency, not a substitute for server authorization.
- **Status:** Planned; recommended next small implementation milestone.

### 3. Longitudinal FHIR Observation engine

- **Goal:** Extract one supported coded Quantity series as portable, disposable analysis.
- **Dependencies:** Item 2; patient/source context and time/unit policy.
- **Acceptance:** Isolate patients, retain source references, preserve effective-time
  precision and status; separate incompatible codes/units, handle missing/unsupported values
  explicitly and avoid normality or treatment inference. Cover deterministic synthetic cases.
- **Status:** Planned; no longitudinal engine currently implemented.

### 4. Trends and graphs

- **Goal:** Render one engine-produced series with a selectable time range and accessible
  values; keep clinical grouping out of UI.
- **Dependencies:** Item 3 and a small chart/accessibility decision.
- **Acceptance:** Correct time/unit labels, empty/gap states, original-record navigation,
  readable narrow/large-text layouts and equivalent accessible values; no invented points,
  silently joined incompatible data or inferred normality.
- **Status:** Planned; graph implementation is separate from series extraction.

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
