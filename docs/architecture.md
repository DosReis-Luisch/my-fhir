# Architecture

See [product direction](product-direction.md) for the patient-first wallet, future
professional workspaces, distinct identity/access concepts and future integration boundaries.

Future account/patient identity, authorization, acquisition, provenance and lifecycle requirements
are defined in [integration architecture](integration-architecture.md). See the [product backlog](backlog.md)
for completed milestones and prioritized small implementation slices. These documents describe
future requirements and do not change the implemented boundaries below.

## Direction of dependencies

```text
patient app ────────> fhir-renderer ────> fhir-core
     │                                     ↑
     └─────────────> synthetic samples ─────┘
```

`fhir-core` uses the R4 definitions from DefinitelyTyped's `@types/fhir` (`fhir/r4`,
generated from HL7 R4 4.0.1). It re-exports native resource types and provides small
helpers. `isResource` discriminates an already typed resource by `resourceType`;
`resourceTypeOf` and `ownField` inspect unknown input without asserting FHIR validity.
No complete specification is hand-maintained here.

`fhir-renderer` receives trusted R4 resources and returns disposable presentation
descriptors: title, kind, subtitle, selected labelled values, source paths and notices.
The descriptor retains the original resource object without cloning, normalizing,
stripping unknown properties, or mutation. Consumers must treat it as immutable.
Descriptors are view information, not persisted clinical DTOs or a clinical API.

Neither shared package imports React, Expo, React Native, browser APIs, Node APIs,
sample data, or UI components. They can be consumed by other TypeScript-aware tools
independently of the app. Their workspace entry points intentionally export TypeScript
source; plain Node JavaScript consumers would need a compilation/distribution step.

The app owns routes, layout, styling, accessibility, and interaction. It imports shared
workspaces by package name, never by reaching into another workspace's source tree.
Expo's standard Metro monorepo support handles workspace source; there are no custom
resolver aliases, copied dependencies, or extra monorepo orchestration tools.

## Rendering strategy

The intended long-term order is specialized clinical rendering, profile-driven
rendering using StructureDefinitions, then generic fallback. Phase 0 implements
resource-specific Patient and Observation functions and the fallback only. No profile
plugin registry or speculative resolver API is introduced before there is a real use case.
Phase 0.1 hardens result/time handling without changing the presentation descriptor model.

- Patient: supplied name, date of birth, administrative gender.
- Observation: supplied code text/display, quantity (including comparator and unit),
  coded display, string, boolean, integer, supported components, effectiveDateTime and
  status. Zero and false are retained. No terminology-based inference or unit conversion.
- Other R4 resource types: type and logical identity, with an explicit fallback notice.
- Modifier extensions anywhere in a resource: conservative generic fallback, because
  ignoring them could change clinical meaning.
- Cancelled or entered-in-error observations: generic fallback with explicit status;
  result values are withheld from the summary. Other statuses remain visible in details.
- Supplied unsupported Observation values, including component values: generic fallback
  for the entire record. Supported forms without a usable display and multiple supplied
  value choices also fall back, rather than claiming absence or choosing a result.

All summaries state that only selected fields are shown. Unknown fields, extensions,
unsupported value choices and declared profiles remain in the original resource and
are not promoted into interpreted clinical facts. The details screen can expose that
source as plain text JSON. Resource narratives are never rendered as executable HTML.
Genuinely absent values are labelled unavailable or use a supplied dataAbsentReason.
Supplied unsupported values are explicitly identified as unsupported and retained in source.
Source paths identify summarized elements, not a complete coverage or FHIRPath model.
Dates retain source precision/timezone rather than inventing a time or converting a
partial date. `effectiveDateTime` is labelled **Clinically effective time**, following
[FHIR R4 semantics](https://hl7.org/fhir/R4/observation-definitions.html#Observation.effective_x_);
it is not a recording or persistence timestamp. No normality classification or medical
advice is inferred.

## Current boundary and limitations

### StructureDefinition inspection (Phase 1A)

`fhir-core` exposes two read-only functions using the existing native R4 types:

- `inspectStructureDefinition(definition)` returns `StructureDefinitionInspection`.
  Its `metadata` copies URL, business version, name, title, description, defined type,
  kind, derivation and baseDefinition. `status: 'available'` exposes an ordered `elements`
  array from an explicit nonempty `snapshot.element`. Each entry retains ID, path,
  sliceName, min/max (including `*`), type codes/profile/targetProfile/versioning,
  short/definition text and optional mustSupport/isModifier/isSummary flags.
  No defaults are inferred for absent scalar metadata. Missing type/profile lists become
  empty arrays. IDs, paths and slice names are distinct; entries are never deduplicated.
- `matchDeclaredProfiles(resource, definitions)` returns one `DeclaredProfileMatch` for
  each `meta.profile` declaration in source order, retaining duplicates. Definitions
  come only from the caller's in-memory collection. No registry or I/O is involved.

All returned metadata, objects and arrays are detached and frozen at runtime, with readonly
TypeScript types. Inputs are neither mutated nor frozen. This is a selected metadata view,
not a persisted clinical DTO, a full StructureDefinition schema, or a renderer descriptor.

Canonical matching uses exact, case-sensitive URL equality. For `url|version`, the
business version must match exactly; an unversioned definition does not satisfy a versioned
declaration. For a bare URL, exactly one definition must exist; multiple versions are
ambiguous rather than implicitly choosing the latest. Even duplicate URL/version entries
remain ambiguous. Candidates retain caller order. These are conservative local matching
rules, not a universal canonical resolver. See [FHIR R4 canonical references](https://hl7.org/fhir/R4/references.html#canonical).

Results distinguish `resolved`, `ambiguous` (candidate metadata), and `unresolved` with
`definition-missing`, `version-mismatch`, `resource-type-mismatch` or `unsupported-canonical`.
A unique match must have `kind: 'resource'` and a type matching the declaring resource.
Malformed separator/whitespace forms and fragment/contained references are unsupported;
no URL normalization or full URI validation is attempted.

Both APIs explicitly report `validation: 'not-performed'`. Resolved means that a matching
definition was found, never that the resource conforms. Resolution can succeed while
inspection returns `unavailable` with `snapshot-missing` or `snapshot-empty`. Differential
content is not treated as a snapshot and baseDefinition is not followed. The functions do
not verify whether an explicit snapshot is complete, internally consistent or valid R4.

There is no differential merging, inheritance resolution, slicing interpretation,
FHIRPath, terminology validation, invariant evaluation or cardinality enforcement.
The original `presentResource()` still marks profiles unresolved; the Phase 1B wrapper
below separately reports local matches, now demonstrated in the isolated Phase 1C screen.
Later work must establish definition provenance/completeness, reference and inheritance
policies, and safe profile-driven presentation separately from actual conformance validation.

### Opt-in profile-informed presentation (Phase 1B)

`presentResourceWithProfiles(resource, definitions)` in fhir-renderer composes the unchanged
`presentResource()` output with `matchDeclaredProfiles()` results. It returns:

- `presentation`: the original ResourcePresentation, including labels, values, notices
  and original source identity. Its existing profile-unaware notices remain unchanged;
  the wrapper's `profiles` are the separate authority for local resolution status.
- `profiles`: declared/resolved/unresolved/ambiguous results, with inspected metadata
  availability distinct from resolution. All canonical/version decisions remain in core.
- `fieldHints`: optional sourcePath, declared canonical, profile metadata and element
  metadata. Hints do not replace labels or resource-supplied terminology.
- `limitations` and `validation: 'not-performed'`: available metadata is not validated
  conformance, trusted terminology, clinical normality or proof of snapshot completeness.

The exact correspondence rules are intentionally small:

1. Only an existing Observation presentation can receive hints. Generic fallback always
   wins, including modifier extensions, unsupported values, cancelled and entered-in-error
   resources. Other resource types still receive resolution results but no field hints.
2. Exactly one declaration must be resolved with an available snapshot. Multiple
   declarations suppress all hints, including duplicates or a mix of resolved/unresolved
   declarations. No profile precedence or version preference is introduced.
3. Only existing top-level `valueQuantity` and `effectiveDateTime` presentation fields
   are considered. They map explicitly to `Observation.value[x]` with Quantity and
   `Observation.effective[x]` with dateTime respectively. No components, other value
   choices or arbitrary element paths are mapped. Source paths are not FHIRPath.
4. A target path must occur exactly once, have its exact unsliced path as ID, and have
   that ID occur exactly once in the snapshot. Slice names, sliced IDs, modifier elements,
   slicing declarations and element modifier extensions suppress that field's hint.
   Definition-level modifier extensions suppress all hints. Source definitions are
   recovered through core's matcher to inspect safety metadata omitted by Phase 1A.
5. The corresponding type code must occur exactly once in the element's declared types;
   other choice types may coexist. Missing or incompatible types suppress hints. No
   metadata can create a resource value, even if min or mustSupport suggests an obligation.

Hint metadata, profile results, limitations and the wrapper are detached/frozen where
appropriate. The base presentation retains its existing contract and original source
reference; neither caller resources nor definitions are mutated or frozen. The synthetic
pulse example supplies a short description for its Quantity choice.
Snapshots may still be incomplete or invalid: these local correspondence guards do not
evaluate slicing semantics, cardinalities, constraints, inheritance, FHIRPath or terminology.
This is profile-informed metadata composition, not universal profile-driven rendering.

### Visual profile inspection demo (Phase 1C)

The patient app's `/profile-inspection` route calls the existing wrapper with the synthetic
pulse Observation and its local StructureDefinition. A labelled developer/demo link sits
separately below the overview's health-record cards. Existing record navigation, IDs,
measurements and synthetic Bundle membership are unchanged.

The app renders returned presentation fields, resolution results and field hints only;
it does not resolve or inspect profiles itself. Resolved, available and validated remain
distinct. The screen prominently states that profile conformance has not been validated,
labels mustSupport as metadata, and groups profile-unaware base notices separately from
opt-in results. Empty/unavailable states do not invent metadata. This read-only engineering
demo introduces no engine changes, registry, external FHIR inputs or validation behavior.

### Application and remote-data boundary

Phase 2A uses Expo Router's standard Tabs in `app/(wallet)` for Home (`/`), Records
(`/records`) and Me (`/me`). Record details (`/record/[id]`) and the developer inspector
(`/profile-inspection`) remain in the outer Stack. The group does not change public URLs.
Tab pages omit Page's bottom safe-area edge because the normal, non-overlay tab bar owns
that inset. Detail/developer pages retain all safe-area edges. Back navigation uses router
history with direct-link fallbacks to Records or Me.

`apps/patient/src/data/demoRecords.ts` selects existing native Observations by exact Patient
reference and lists Organization context separately. It is a read-only demo selector, not an
authorization check, reference resolver or clinical repository. All clinical presentation
still comes from the unchanged renderer. Me describes the Patient context, not an account.
No sample IDs, resource shapes or Bundle membership changed in Phase 2A.

The synthetic workspace owns one fictional Patient, three Observations (including a
blood-pressure component example), and one Organization, also exported as a native
collection Bundle. Overview observations are selected by the exact local Patient
reference. There is no general reference resolver or remote input boundary yet. The independent
Phase 3A synthetic acquisition package below is not wired into the wallet.
Detail routes use locally unique fixture IDs; before introducing remote/multi-type
records they must use resource type plus ID and server context to avoid collisions.

Compile-time typing does not validate incoming JSON. A future remote/import boundary
must perform runtime FHIR validation before specialized interpretation, including
resource invariants, value choices, profiles, modifier semantics and terminology.
FHIR resource IDs alone are not globally unique. Profile declarations are informational
and remain explicitly unresolved in the original renderer. Callers can separately match
known local definitions through fhir-core or opt into the Phase 1B composition. This is
not universal FHIR/profile support.

### Source-aware synthetic acquisition (Phase 3A)

`packages/fhir-acquisition` is a private portable workspace, depending only on
`@myfhir/fhir-core`. It separates acquisition state from clinical helpers and rendering for
future reuse across platforms and adapters. It has no application, sample, renderer,
React/Expo, network, storage, authentication or hardware dependencies. No connector, UI
or existing rendering/profile inspection behavior is changed.

The public entry point `createAcquisitionStore()` returns an in-memory object with:

- `acquire({ sourceNamespace, patientContext, resource })`: inspect a synthetic native R4
  object and return `acquired`, `duplicate`, `rejected` with a reason, or `conflict` with the
  existing record. Every result and acquired record's metadata report `validation: 'basic-guards-only'`,
  `fhirValidation: 'not-performed'` and `authorization: 'not-checked'`.
- `records()`: a frozen insertion-order snapshot of all acquired records in this store,
  potentially spanning contexts. It is not an authorized patient query or a latest-version
  view. Callers must isolate/select context before any future display or analysis.

Exported types include `AcquisitionRequest`, `AcquisitionResult`, `AcquisitionIssue`,
`AcquisitionStore`, `SourceQualifiedIdentity`, `PatientContext`, `AcquiredResource` and
`DeepReadonly`. A record retains the native Patient/Observation shape as an immutable,
detached snapshot; identity/version/patient context are separate metadata. Caller-owned
objects are neither changed nor frozen. Snapshots preserve unknown fields, extensions,
clinical values, identifiers and date strings; byte-level serialization is not retained.

Identity is the exact case-sensitive source namespace, resource type and logical ID tuple.
Namespace is caller-supplied and opaque, with no URL normalization; adapters must allocate
stable namespaces including tenant/customer partition where needed. Logical IDs and supplied
`meta.versionId` must match `[A-Za-z0-9.-]{1,64}`. Version is stored separately from identity;
an absent version is its own comparison bucket, not an invented version or latest record.
The internal tuple encoding avoids delimiter collisions.

Each acquire call requires exactly one context `{ sourceNamespace, patientId }`, with the
same namespace as the acquired resource. A Patient must have that ID. An Observation must
have an exact relative unversioned `subject.reference` of `Patient/<id>` within that source.
The Patient resource need not already be in the store: this is explicit-context consistency,
not inferred batch membership. Missing references, identifier-only or multiple/malformed
subjects, and reference-plus-identifier assertions are rejected with explicit reasons.
Absolute, contained, URN, bare-ID and history references are unsupported; a supplied
`subject.type` must be exactly `Patient`. Nothing resolves cross-source identity or proves
authorization. Rejected input is not stored or sent to interpretation.

Repeat acquisition compares all supplied JSON content, ignoring object property order but
preserving array order and value differences. Equal source/type/ID/version and content return
the existing record as `duplicate`. Different content in that bucket returns a conflict and
does not overwrite; different versions remain separate, with no version ordering or merging.
Independent resource IDs/events are never collapsed merely because measurements match.
Unknown-field changes also conflict. Content comparison is not a cryptographic hash.

Runtime guards require plain JSON data, supported resource type/ID/version and, for
Observation, a recognized R4 status and object-shaped code. They reject cycles, accessors,
symbols, non-enumerable/custom properties, undefined, non-finite numbers, sparse arrays and
non-plain objects rather than silently discarding/changing values. Inspection is bounded to
depth 64 and 10,000 visited values, with oversized property collections rejected early.
These are basic guards, not full FHIR R4, StructureDefinition, terminology or clinical
validation. Optional clinical structures, value-choice invariants and modifier semantics
are not validated or interpreted. Such fields remain intact; acquisition success is not
eligibility for specialized clinical interpretation. This package invokes no renderer and
cannot bypass its existing fallbacks; a future bridge must enforce its own supported-input
policy and accurately report validation limits.

No Bundle/file import, general reference resolution, timestamps/provenance verification,
persistence, grants or source authenticity checks are implemented. Input is limited to
caller-provided synthetic plain-data objects, not arbitrary executable objects/proxies or
an adversarial file parser. In-memory state is discarded with the store; conflicts retain
only the prior record, and callers retain rejected/conflicting input for any later review.
The package does not choose retention or synchronization policies.

Maintainer-reported Phase 3A validation: installation completed, **163 tests passed**,
TypeScript and lint passed, and formatting passed with `--end-of-line auto`. These results
apply to the Phase 3A baseline; they are not validation of Phase 3B. The existing workspace
and test globs discover these packages without config changes.

### Longitudinal coded Quantity analysis (Phase 3B, validation pending)

`packages/fhir-longitudinal` is a separate private portable workspace depending only on
`@myfhir/fhir-acquisition` and `@myfhir/fhir-core`. Analysis stays separate from acquisition
state and presentation; it introduces no generic analysis framework or external runtime
dependencies. No existing screens, synthetic dashboard values, rendering or profile
inspection behavior change.

`analyzeQuantitySeries(records, request)` accepts immutable acquired snapshots and an
explicit `patientContext` plus `measurement: { coding: { system, code }, unit: { system, code } }`.
Each call supports exactly one coding and one coded unit, acting as an explicit singleton
unit allowlist; there is no built-in clinical measurement catalog. The caller is responsible
for choosing an appropriate selection. Invalid empty/whitespace selection or invalid patient
ID throws `RangeError`; empty input returns an empty series with limitations.

The engine matches both the source-qualified acquisition identity/context and Patient
reference. Different namespaces are never reconciled, even with identical bare IDs.
Context filtering is analysis consistency only, not authorization. `store.records()` may
span patients/sources and is not an authorized query. The engine does not mutate input or
invoke a renderer; full FHIR/profile/terminology/clinical validation is not performed.

Supported selection is deliberately narrow:

- Observation status must be exactly `final`; all other statuses, including cancelled,
  entered-in-error, amended and corrected, are excluded.
- `code.coding` must contain exactly one entry with the exact, case-sensitive supplied
  system/code and no coding version. Display/text is never used to infer meaning or
  equivalence. Additional/alternative codings are excluded rather than reconciled.
- `valueQuantity.value` must be a finite number, including zero. Quantity system/code must
  match the selected unit exactly; unit display text is not identity. There are no conversions.
  Any comparator is excluded because a bound is not an exact measurement.
- Other `value[x]` choices, components, dataAbsentReason and any supplied specimen, method
  or bodySite are excluded, even alongside an otherwise usable Quantity. No context matching
  or clinical comparability is inferred from absent fields.
- Nonempty or malformed modifierExtension anywhere in the resource excludes it. Ordinary
  unknown fields/extensions remain untouched; no profile/extension semantics are resolved.
- Clinically effective time must be a complete `effectiveDateTime` with seconds and a known
  explicit `Z` or numeric offset. Gregorian calendar/time/offset bounds are checked; fractions
  are supported only to three digits. Partial dates, missing zone/seconds, invalid dates,
  leap seconds, unknown `-00:00` offsets and other/competing effective forms are excluded.
  Offset limits are +/-14:00. Supplied strings/precision are preserved. Instants are calculated
  only for ordering; no acquisition/issued timestamp substitutes for clinical effective time.

Before clinical selection, the entire supplied collection is grouped by source/type/logical
ID, independently of version and patient context. Every relevant revision of a multi-version
Observation identity is excluded as `multiple-retained-versions`; an absent version plus a
supplied version is also ambiguous. An older cancelled or differently associated revision
cannot be hidden by filtering first. Repeated same-identity/version entries (even repeated
references) are conservatively excluded as `repeated-observation-identity`. No authoritative
current-version selector is implemented; no numeric/lexical version ordering is used. A
caller omitting retained revisions cannot be detected by this engine. Independent IDs with
equal values remain distinct events.

The frozen, disposable `QuantitySeries` contains measurement coding/unit, a copied patient
context, ordered `MeasurementPoint` objects, `ObservationExclusion` objects and limitations.
Each point retains its exact `AcquiredResource` object reference and supplied effective time;
source identity, version and native resource remain available through `point.record`.
Exclusions also retain the original record and one explicit reason (the first failing guard).
Points order by instant, then original timestamp string and source-qualified identity for
ties; exclusions order by identity/version/reason/content for deterministic results independent
of input order. No range, normality, diagnosis, treatment or clinical-comparability result
is produced. Exported selection/result types include `CodingSelection`, `QuantitySeriesRequest`,
`MeasurementPoint`, `ExclusionReason`, `ObservationExclusion` and `QuantitySeries`.

Phase 3B source and synthetic tests are written but **unvalidated**. The new workspace needs
maintainer installation/lockfile regeneration before validation. No install, tests, build,
formatter or Expo was run in this milestone; `package-lock.json` was left unchanged.

No authentication, network access, database, server, persistence, cloud services, FHIRPath,
terminology lookup, full profile resolution, or clinical decision support is implemented.
Native distribution and app-store metadata are future work. No .NET project is present.
