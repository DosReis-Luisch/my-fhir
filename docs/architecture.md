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
Phase 3A synthetic acquisition package below is used by the separate Phase 3C Trends source;
the original dashboard selector and Bundle remain unchanged.
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

### Longitudinal coded Quantity analysis (Phase 3B)

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

Maintainer-reported Phase 3B results: **224 tests passed**, TypeScript and ESLint passed,
and Prettier passed with `--end-of-line auto`. Phase 3B was merged via PR #9. These are
baseline results, not validation of Phase 3C.

### First body-weight Trends screen (Phase 3C, merged; runtime verification pending)

The wallet now includes `/trends` alongside Home, Records and Me. It shows the existing
fictional Alex Morgan context, Body weight in kg, range controls, a responsive line chart
and an oldest-first accessible list with exact supplied timestamps and original-record links.
Fictional-data and non-interpretation notices remain visible. The existing logo/palette,
dashboard measurements, demo Bundle and `/record/[id]` lookup are unchanged.

Ten hand-authored R4 Observations in `samples/synthetic/src/weightHistory.ts` span January
through October 2026. They have distinct logical IDs, version `1`, final status, LOINC
`29463-7`, UCUM `kg` and complete offset-qualified clinical times. They are exported
separately with the explicit fictional source/patient context and are not added to the
original `resources` or Bundle. No real-provider provenance or identity verification is implied.

`apps/patient/src/data/weightTrend.ts` acquires those resources with `createAcquisitionStore`,
then calls `analyzeQuantitySeries` for that exact source/patient/coding/unit. Chart and list
consume its same immutable measurement points and acquired record references. Acquisition
failures and engine exclusions are reported as preparation notices, not silently interpreted
in UI. No patient matching, unit comparability, clinical grouping or version selection is
duplicated in the application. The existing engines are unchanged.

`selectTrendRange` is only a presentation window over engine-ordered points. 1M/6M/1Y
subtract one/six/twelve UTC calendar months from the latest included clinical instant, clamp
the day to the destination month's last day and include both endpoints. All starts at the
first included measurement. No device current time is consulted. Points retain their exact
values, timestamps and references across range switches. If the engine has no eligible
points, every range is empty with an explicit message. Nonempty input necessarily includes
its latest point in each range; the supplied 1M example has one dot rather than an invented
line/history. Calendar windows and graph UTC axis labels do not rewrite source timestamps.

`WeightTrendChart` uses `react-native-svg` **15.15.4**, the version specified by the installed
Expo **57.0.30** compatibility map used during implementation; the merged baseline retains
that SVG version with Expo 57.0.31 and Router 57.0.29 in the lockfile. No large chart
framework or animation system is introduced.
The pure `trendChartGeometry` maps actual elapsed clinical time to horizontal position, so
unequal time gaps are unequal distances. The kg scale starts at zero and has a stable upper
bound of at least 100 across ranges, derived from the full series. Straight connectors are
visual guides between actual dots, not estimated/interpolated measurements. There are no
normality bands, trends-as-diagnoses or smoothing. Container layout sets chart width on web
and native. A labelled accessible chart summary is supplemented by scalable text/list links;
the SVG is not the only way to read measurements.

`/trend-record/[id]?source=...&type=Observation&version=...` is a separate narrow synthetic
detail route. `trendRecordParams` supplies the exact source/type/logical-ID/version tuple;
`findTrendPoint` resolves only that tuple within the known fictional source/patient's
engine-selected points. Missing/ambiguous query parameters, wrong source/type/version and
unknown IDs produce a missing-record message. There is no bare-ID fallback, URL fetching,
cross-source identity inference or reuse of the original demo lookup. The detail screen
shows the exact engine value/time, acquired source identity and selectable original FHIR JSON,
without cloning into a clinical DTO. Back uses real history or falls back to Trends on direct
entry. Context checking and local lookup are not authorization.

Pure application preparation/range/lookup/geometry cases are in
`packages/fhir-longitudinal/tests/patientTrends.test.ts`, using the existing Node test glob.
These tests import the pure application helpers; portable engine production code does not
import the app, samples, React or SVG. Tests cover engine derivation, original-demo
separation, month boundaries, offsets, empty results, source collisions, unchanged originals
and unequal temporal spacing. No UI runner or screenshot harness was added.

Phase 3C merged through **PR #10**, commit `15408b1`. The maintainer previously reported
234 tests passing plus TypeScript, ESLint, Prettier and Expo Doctor passing; these are
historical results, not Phase 4A validation. Web/iPhone runtime verification remains
outstanding: layout, VoiceOver, range switching, navigation/direct links and absence of
the web SVG attribute warning. The merged SDK baseline is Expo 57.0.31, Router 57.0.29
and SVG 15.15.4. No checks were rerun in Phase 4A. The SVG has no zoom/tooltips or
interactive point selection; exact measurements are in the list. This source-only milestone
does not establish native-client compatibility, full FHIR validation or production privacy.

No authentication, network access, database, server, persistence, cloud services, FHIRPath,
terminology lookup, full profile resolution, or clinical decision support is implemented.
Native distribution and app-store metadata are future work. No .NET project is present.

### Clinical catalog and organization (Phase 4A)

`packages/fhir-catalog` is a private portable TypeScript workspace for reuse across web,
mobile and later adapters. It depends on acquisition/core and uses longitudinal result
types; it does not import React, Expo, Node/browser APIs, sample data or the renderer.
There are no external runtime dependencies, network calls, terminology lookups, storage,
authentication or plugin framework. Acquisition, renderer and longitudinal implementation
code was unchanged in Phase 4A. Phase 4A merged through **PR #11**, commit `af1a7c2`;
web/iPhone runtime verification remains outstanding. The foundation described in this section
is extended by the [Phase 4B slice](#laboratory-results-and-diagnosticreports-phase-4b) below.

`buildClinicalCatalog(records, patientContext, histories = [])` accepts immutable acquired
Patient/Observation snapshots and one explicit source-qualified Patient context. It returns
a frozen `ClinicalCatalog`: items, nonempty clinical groups, explicit out-of-context
exclusions, history sections, limitations, `validation: 'not-performed'` and
`authorization: 'not-checked'`. `store.records()` is not an authorized query; catalog
filtering checks source/patient consistency only. Invalid context throws `RangeError`.
The caller must provide acquisition snapshots, not arbitrary JSON or fabricated descriptors.

Each `CatalogItem` retains the exact `AcquiredResource` and native resource references,
identity, separate available version, patient context, resource type, category, reason,
classification evidence paths/system/code/version, capabilities, limitations and explicit
reference assertions. No clinical value is copied into a parallel model. All newly created
objects/arrays are frozen; native resources remain the already frozen acquisition snapshots.
Repeated references to the same snapshot are listed once. Different versions are retained,
never ranked or selected as latest; independent equal-valued events are not deduplicated.
Items sort lexically by encoded source/type/ID/version tuple, not by clinical date or display
label. Groups have fixed vital-signs, laboratory, unclassified order and omit empty groups.
Records from separate stores with conflicting identity/version content must be reconciled
at acquisition; this catalog is not a second conflict resolver.

The distinctions are deliberate:

- **FHIR resource type** is the native shape, not the clinical category. Patient remains
  a context descriptor, not a clinical group entry. Organization remains existing supporting
  demo context outside acquisition/catalog, not a patient record or care-relationship claim.
- **Clinical category** is disposable application organization. Only Observation category
  coding with exact system `http://terminology.hl7.org/CodeSystem/observation-category`
  and code `vital-signs` or `laboratory` is supported. All supplied category concepts/codings
  must be supported, unversioned and agree. Repeated agreeing codings are retained as
  evidence without duplicating the record. Both recognized codes, mixed conflicting codes,
  unsupported/foreign/versioned/malformed coding, text-only or missing categories become
  unclassified with an explicit reason. Nonempty/malformed modifier extensions anywhere
  also force unclassified. Display text, names, IDs and filenames never determine category.
  Category is not a status/value safety check; existing renderer fallbacks still apply.
- **Source-qualified identity** is source/type/logical ID with version separate. Matching
  names, codes or bare IDs never reconcile patients/sources. Every catalog has one context;
  multi-context UI and authorization remain future work.
- **Resource relationships** describe supplied references, not inferred links. The current
  Observation slice captures subject, derivedFrom, hasMember, basedOn, partOf, specimen,
  encounter, device, performer and focus paths, raw reference strings and source/patient
  context. Every assertion is unresolved; identifier-only/malformed assertions explicitly
  report unsupported-reference and remain intact in the original. Even a locally present
  target is not traversed. No date/value/display matching creates a relationship.
- **Numerical trends** require existing longitudinal selection, not category membership.
  Optional `QuantitySeries` evidence grants numerical-history capability only to the exact
  same acquired object references in same-context engine points. No analysis rules are
  duplicated. A valid uncategorized weight point can have numerical-history capability;
  a laboratory or vital-sign category alone cannot grant it. The typed engine result is
  trusted input, not a security credential or runtime validation of caller-supplied series.
- **Non-numerical timelines** for reports, conditions and imaging are planned, not empty
  implemented histories or numerical series. The catalog supplies a planned history section
  with no items. No timeline dates are invented from partial/ambiguous clinical time.
- **Clinical presentation** remains the conservative renderer's responsibility, distinct
  from classification and from full FHIR/profile/terminology/clinical validation. Presentation
  capability means the renderer can provide its existing specialized or generic fallback,
  never that specialized interpretation is safe for every classified record.

`apps/patient/src/data/clinicalCatalog.ts` is the shared application bridge. It acquires the
existing Patient and three dashboard Observations in a fixed synthetic dashboard namespace,
reports acquisition issues, and builds Records groups. It separately catalogs the existing
weight engine's point/exclusion records with that engine's history evidence. The two sources
are not merged despite their common fictional Patient ID. No fixtures, original Bundle
membership, dashboard values, weight preparation/ranges or SVG/chart geometry are changed.
Laboratory classification is exercised by separate fictional test resources; no additional
record is invented in the UI. The bridge's documented R4 type assertion accommodates the
legacy read-only renderer's mutable TypeScript signature while passing the frozen snapshot
itself; renderer behavior and source preservation are covered by adapter tests.

Records shows catalog section headings/counts and original-record links with source, type,
ID and optional version. The detail route performs an exact fixed-context lookup for qualified
links and never falls back to a bare ID if qualification is wrong/ambiguous. Existing bare-ID
links remain restricted to the original fixed demo resources for Home/supporting context.
This legacy path is not a remote/multi-source lookup. Trends adds catalog-owned numerical
and planned-other-history section labels; its actual weight series/list/chart still comes
exclusively from the unchanged longitudinal engine.

Additional categories are design direction: imaging/examinations, reports/documents,
conditions/diagnoses, medications, immunizations and procedures. Phase 4A acquisition supported
only Patient/Observation; Phase 4B below adds DiagnosticReport. ImagingStudy, DocumentReference,
Condition and other types remain unsupported. A future general resolver must use explicit same-source and patient context,
type/ID and requested version, preserve missing/ambiguous targets, review shared/non-patient
and contained/absolute-reference policies, and enforce authorization separately before any
fetch. DiagnosticReport results may reference multiple Observations; they are not a single
measurement. ImagingStudy metadata does not contain image pixels. Imaging/DICOM content
retrieval, protected endpoints, supported formats/viewers, authorization, privacy and large
payload handling require later reviewed adapters. No DICOM viewer, imaging retrieval,
laboratory interpretation or universal FHIR classification exists in this milestone.

Focused tests in `packages/fhir-catalog/tests` cover classification, ambiguity, unsupported
forms, isolation, versions, immutable output, preservation, deterministic groups, unresolved
relationships, engine capability evidence and shared Records/Trends adapters. No checks were
executed during the Phase 4A implementation turn; this document does not supply new results.
The workspace/lockfile were included in the Phase 4A merge. Outstanding checks include
web/iPhone Records/details and unchanged Trends/ranges/accessibility. The
November 3 SDK 57 dependency-security baseline and its release prerequisites remain in force.

### Laboratory results and DiagnosticReports (Phase 4B)

Data flow is native FHIR acquisition -> clinical catalog -> explicit local report/result
relationships -> renderer and Records UI. Phase 4B merged through **PR #12**, commit
`543d718`. Web/iPhone runtime acceptance remains unverified; no new validation results
are claimed here. The Phase 4B slice added no workspace, external dependency,
backend, networking, persistence, authentication or terminology service. The November 3
SDK 57 security assessment remains unchanged and unresolved; synthetic demonstration and
local context checks are not authorization, clinical validation or production approval.

`fhir-core` now exports native R4 `DiagnosticReport`. Acquisition accepts exactly Patient,
Observation and DiagnosticReport; other resource types remain rejected. Reports retain the
existing immutable JSON snapshot, source/type/logical-ID identity, separate optional version,
duplicate/content-conflict semantics and explicit source-qualified Patient context. All
recognized R4 report statuses are accepted structurally, including partial/appended and
cancelled/entered-in-error; acquisition is not presentation eligibility. Code must be an
object with nonempty text and/or a nonempty coding array of object entries with nonempty
codes and optional nonempty systems. Malformed supplied text/coding is rejected as
`invalid-diagnostic-report-shape`. No terminology or comprehensive CodeableConcept validation
is claimed. Exact relative `Patient/<id>` subject association and bounded plain-JSON guards
are unchanged; missing, foreign, identifier-only and ambiguous subjects are rejected.
Unsupported fields, unknown properties, extensions and attachments remain in the snapshot.

A **DiagnosticReport** is a report record that may reference several individual results;
an **Observation** remains an independently identified result with its own status, category,
values and dates. The report's category never classifies its referenced Observations.
Catalog classification is exact and case-sensitive, with distinct coding systems:

- Observation rules remain unchanged: unversioned
  `http://terminology.hl7.org/CodeSystem/observation-category` with `vital-signs` or
  `laboratory`, with all supplied category codings supported and agreeing.
- DiagnosticReport uses only unversioned
  `http://terminology.hl7.org/CodeSystem/v2-0074` with `LAB`. All supplied category
  concepts/codings must be supported and agree; repeated LAB evidence does not duplicate
  the report. Unknown, conflicting, malformed, versioned or modifier-bearing categories
  remain unclassified, with retained evidence and reasons. Code text such as laboratory,
  blood or analysis never determines category.

`ClinicalCategory` adds `laboratory-report`; `diagnosticReportCategorySystem` is exported.
Nonempty groups order vital signs, laboratory reports, laboratory results, other/unclassified.
Reports are included in groups, including unclassified reports; Patient remains context only.
Report counts and result counts are separate record counts, not a count of clinical events.
Versions remain separate descriptors with no latest-version inference.

`buildClinicalCatalog` keeps its signature. `CatalogRelationship` is now a readonly union:
`kind` is assertion or report-result, with supplied path/reference/source context; unresolved
relationships have a `RelationshipIssue` reason, while resolved ones retain the exact target
`AcquiredResource`. It does not contain recursive CatalogItem graphs or copied result values.
Only DiagnosticReport.result has local resolution; existing Observation assertions remain
unresolved exactly as before. Result references resolve only when:

1. The supplied result collection is an array and its entry asserts exactly
   `Observation/<logical-id>` with no identifier assertion or incompatible type. Absolute,
   contained, versioned, identifier-only, malformed and other-type references are unsupported.
2. A supplied target Observation has the report's exact source namespace and patient context.
   A matching bare ID in another source/patient does not qualify.
3. All retained same-source target identities are considered before patient filtering.
   Multiple versions, including absent plus supplied version, yield
   `multiple-retained-versions`; no numeric or lexical version ordering is used. Multiple
   distinct snapshots under one remaining identity/version yield `ambiguous-target`.
4. The report contains no unsupported modifier semantics; such reports hold links with
   `unsafe-report`. Resolution otherwise asserts a structural link only, not safe clinical
   interpretation or approval of either record's status/value.

Other unresolved reasons include `unsupported-reference`, `missing-target`, `source-mismatch`
and `patient-mismatch`; Observation assertions retain `resolution-not-implemented` or
`unsupported-reference`. All original assertions remain at their resource path, including
identifier-only details. Duplicated result references retain their original paths/order but
do not manufacture duplicate resources. Repeated references to the identical acquired target
object are not extra candidates. No recursive traversal, date/text/value matching, network
fetching or external endpoint resolution occurs. Omitted records/versions cannot be detected:
the caller must provide the complete retained collection, not an authorized-query assumption.

The renderer adds `ResourcePresentation.kind: 'diagnostic-report'`. Its first slice summarizes
only final reports with supported selected metadata: supplied title/code display, report
status, effectiveDateTime and issued as separate labelled source strings. Dates retain source
precision/offset and are neither parsed, validated, converted nor replaced with each other;
partial clinical dates remain partial. Missing dates create no invented time. Competing or
unsupported effective forms, non-string/empty times, malformed selected code, non-final
statuses and modifier extensions fall back to preserved generic records. Supplied narratives,
conclusions/conclusionCode, media, imagingStudy or presentedForm also fall back; no XHTML is
rendered as HTML and no attachment is fetched, opened or decoded. Original JSON remains
available as selectable plain text. No reference ranges, abnormality, medical conclusions
or treatment advice are inferred. Existing Patient/Observation rendering and profile hints
are unchanged; report classification and report metadata presentation are independent.

`samples/synthetic/src/laboratory.ts` separately exports one fictional final report and two
fictional final laboratory Observations (sodium/potassium), with distinct IDs, version 1 and
explicit relative result/Patient references. `laboratoryContext` explicitly declares the
same fictional dashboard source/patient; no new cross-source identity is inferred. The app
acquires these resources alongside the dashboard fixtures, using that declared context.
The original three Observations, `resources`, collection Bundle, Home selector and weight
history are unchanged. The report's two different analyses do not constitute a time series;
laboratory history remains unavailable, with no numerical capability added to Records.

Records renders only populated report/result/unclassified groups. Compact report cards retain
status and supplied dates. Existing `/record/[id]` details display each supplied result
assertion and either an exact source/type/ID/version-qualified local Observation link or
an explicit unresolved reason. Supported report summaries show linked result cards through
the unchanged Observation renderer. Generic/non-final reports show identity links only,
withholding result summaries so they do not imply a finalized clinical conclusion. Result
Observations remain independently discoverable in Laboratory results. The original report
JSON is accessible. Qualified lookup failures never fall back to bare IDs; legacy fixed-demo
links remain restricted to the original demo resources. Back navigation is unchanged.
The Trends screen, chart, 1M/6M/1Y/All helpers and longitudinal engine are unchanged.

Synthetic tests cover acquisition status/subject/code/JSON guards, duplicate/conflict/version
and preservation rules; independent report/result classification and unclassified retention;
same-source/patient resolution, missing/foreign/ambiguous/versioned/unsupported assertions,
duplicate references, frozen stable descriptors and unchanged Observation assertions;
renderer fallback and original-source retention; app qualified navigation, separate groups,
unchanged dashboard/Bundle and ten-point weight ranges. Tests have not been run. Maintainer
must run focused/full tests, TypeScript, lint, formatting and web/iPhone checks, including
status/date visibility, original JSON, result links, Back/direct links and accessibility.

Later reviewed slices must define longitudinal laboratory grouping and reference-range/clinical
interpretation policies, DiagnosticReport.presentedForm/PDF handling, ImagingStudy/DICOM
metadata and content retrieval/viewing, external reference/contained/versioned resolution,
and authentication, authorization, verified provenance and protected storage. This milestone
implements none of those capabilities or dependencies. Outstanding Phase 4A and Phase 3C
web/iPhone checks remain outstanding until the maintainer records runtime evidence.

### Imaging studies and radiology reports (Phase 4C)

This slice adds a fictional ImagingStudy and radiology DiagnosticReport through the existing
acquisition -> catalog -> local relationships -> renderer/Records flow. It is source-only,
**awaiting maintainer validation and GitHub review; not complete**. The Phase 4B laboratory
fixtures, original three dashboard measurements, Bundle membership, Patient, ten-point
weight history, Trends chart/ranges and longitudinal implementation remain unchanged.
No new workspace, external dependency, endpoint, image viewer, backend, network call or
persistence is added. The SDK 57 dependency-security baseline remains unresolved and its
external-connection, real-data and release prerequisites still apply.

#### Native acquisition and metadata limits

`fhir-core` exports native R4 `ImagingStudy` and the portable boolean helper
`hasSupportedImagingStudyMetadata(unknown)`. The helper inspects selected metadata shapes,
not full FHIR/DICOM conformance and not a TypeScript resource type predicate. It is shared
by acquisition and rendering to avoid two conflicting shape policies. Acquisition accepts
exactly Patient, Observation, DiagnosticReport and ImagingStudy. Studies require valid
logical ID/optional version, a recognized status (`registered`, `available`, `cancelled`,
`entered-in-error`, `unknown`) and the existing exact relative `Patient/<id>` subject in
the supplied source/patient context. Group/Device, missing, foreign, identifier-only and
ambiguous subjects remain unsupported. JSON bounds, detached frozen snapshots, source/type/ID
identity, separate version and duplicate/content-conflict rules are unchanged.

Supplied descriptions/start strings must be nonempty strings; counts/sequence numbers must
be nonnegative safe integers. Modality and SOP Class metadata require coding objects with
nonempty system/code and string display/version when supplied. Identifiers require nonempty
values and string systems when supplied; `urn:dicom:uid` values require an explicit
`urn:oid:` numeric dotted UID. Supplied series must be arrays with a UID and modality;
supplied instances must be arrays with a UID and SOP Class coding. UIDs receive limited
numeric dotted syntax/length checks, not allocation, uniqueness or DICOM conformance checks.
Malformed supported fields are rejected as `invalid-imaging-study-shape`, never repaired.
Absent optional study identifiers, series or instances remain absent; no DICOM object or
missing UID is manufactured. Unknown/unsupported fields remain in the original snapshot.
These guards do not validate terminology, clinical accuracy, count consistency, UID provenance,
FHIR invariants or whether any pixels exist. Times remain strings with supplied precision;
calendar/timezone validity is not established and no date is invented or converted.

#### Classification and local relationships

An ImagingStudy describes study/series/instance metadata; a DiagnosticReport is a separate
report with independent status, category and dates. Neither is an image payload or proof
of a completed examination. Studies classify from native `resourceType: ImagingStudy`,
using explicit `{ kind: 'resource-type', path: 'resourceType', resourceType: 'ImagingStudy' }`
evidence. No Observation category coding is invented. Unsupported modifier semantics force
unclassified while preserving discoverability and the original resource.

`ClinicalCategory` adds `radiology-report` and `imaging-study`; `ClassificationReason` adds
`resource-type`; `ClassificationEvidence` includes a resource-type evidence union member.
Reports require exact unversioned system
`http://terminology.hl7.org/CodeSystem/v2-0074` and code `RAD` for radiology, or the existing
`LAB` for laboratory. All supplied report category codings must be supported and agree.
Mixed LAB/RAD, unknown, foreign, malformed or versioned categories and modifier-bearing
records stay unclassified with evidence/reasons. A report's title, code display, narrative,
filename or imagingStudy reference cannot establish radiology classification. Existing
Observation category rules and independent result classification remain unchanged.
Nonempty Records groups order vital signs, laboratory reports, laboratory results,
radiology reports, imaging studies and other/unclassified. Counts refer to separate records.

The same narrowly scoped resolver now accepts exactly two report fields:
`result -> Observation/<id>` and `imagingStudy -> ImagingStudy/<id>`.
`CatalogRelationship.kind` adds `report-imaging-study`. Both sets coexist; result assertions
precede study assertions and the supplied order within each FHIR array is preserved.
The resolver requires an already acquired exact-type target with identical source namespace
and patient context. All retained same-source identity versions are inspected before patient
filtering, so an out-of-context revision cannot make a target appear authoritative.
Multiple versions remain unresolved as `multiple-retained-versions`; distinct duplicate
snapshots at one version remain `ambiguous-target`. No version string is ranked. Repeated
references to the same acquired object are not extra targets; duplicate supplied assertions
retain their paths without manufacturing records.

Missing, foreign-source, foreign-patient, malformed or unsafe links retain existing explicit
reason codes. Absolute URLs, contained references, history/version paths, identifier-only
assertions, reference-plus-identifier assertions and incompatible target types remain
unsupported. Original assertions remain in native JSON at their source path. Existing
Observation assertions stay unresolved; no recursive graph traversal or external fetch is
performed. Resolution is a structural consistency statement, not clinical approval or
authorization. The caller must supply all retained versions; omitted versions cannot be
detected. General external resolution remains future work.

#### Metadata presentation and navigation

`ResourcePresentation.kind` adds `imaging-study`. Registered/available studies with supported
metadata can show supplied description, status, start string, identifiers, reported counts,
listed series/instance metadata counts, raw modality coding, series descriptions/UIDs and
SOP Instance UIDs. Reported counts are never calculated from listed metadata or reconciled
as authoritative totals. Omitted lists do not imply zero instances. Supported modality
coding uses the exact unversioned DICOM DCM system; unknown codes within that system are
shown verbatim without invented friendly names. Unsupported systems/versions, malformed
metadata, cancelled/error/unknown statuses, modifier extensions, narratives, notes and
retrieval endpoints fall back conservatively to preserved originals. The metadata-only
notice is visible on compact study cards and in details.

Study/Series/SOP Instance UIDs are source-supplied imaging identifiers, distinct from the
source-qualified FHIR logical ID/version used in local navigation. A study UID appears as
an Identifier, not an invented ImagingStudy.uid field. Listed instances describe metadata;
they contain no supplied pixels, decoded image, thumbnail, retrieval endpoint or viewer.
UIDs and identifier URIs are plain text; the app does not open them.

DiagnosticReport presentation now permits an imagingStudy reference array alongside result
references while preserving final-status and unsupported-content policy. Non-final reports
and narratives/conclusions/media/PDF attachments still fall back. Local reference resolution
is separate from metadata summarization. Study.started, report.effectiveDateTime and
report.issued remain distinct supplied source fields; none substitutes for another. No
radiological findings, conclusions, normality or treatment advice are interpreted.

The app explicitly acquires `imagingStudy` and `radiologyReport` from the separate synthetic
`imaging.ts` module with its declared `imagingContext`. It verifies that context exactly
matches the intentionally shared dashboard source/patient, rather than relabelling another
source. The fixture contains one structured series and one SOP Instance metadata entry,
fictional UIDs and timestamps, with no real hospital identifiers, pixels or retrieval URLs.
Original `resources`/Bundle membership is unchanged.

Records renders independent report/study groups. Existing record details distinguish supplied
result and study references, show resolved targets through the existing ResourceCard and
show unresolved reasons instead of dropping assertions. Generic/non-final reports retain
identity links without finalized target summaries. Study details list inbound report links
using only already resolved catalog evidence (`reportsForStudy`); this is not a second
resolver or inferred relationship. Every new link carries source/type/ID/version. Invalid
or ambiguous qualified links cannot fall back to bare IDs; legacy links remain restricted
to original fixed-demo records. Original FHIR JSON and Back navigation remain available.
No numerical imaging capability or completed imaging timeline is introduced.

Synthetic tests cover acquisition shape/status/subject/ID/version/conflict/preservation,
resource-type and RAD classification, unclassified retention, mixed result/study references,
source/patient/version ambiguity, duplicates, unsupported references, immutable descriptors,
safe metadata rendering, independent dates, app navigation and laboratory/dashboard/Bundle/
Trends preservation. No tests, installation, builds, formatters or Expo commands were run.
Maintainer validation must run focused/full tests, TypeScript, lint, formatting and web/iPhone
Records/detail/accessibility checks, including both navigation directions and existing flows.

Future authorized adapters must separately define DICOMweb QIDO-RS query and WADO-RS
retrieval, authenticated external sources, ownership/authorization of every study/series/
instance, UID-to-endpoint trust, large payload limits, cancellation/caching, protected storage,
privacy/retention, document/PDF viewing and reviewed imaging timelines. None of these is
implemented here; metadata availability is not permission or technical ability to fetch images.
