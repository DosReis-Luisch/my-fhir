# Architecture

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
No profile-aware UI or new presentation behavior is connected to these APIs. The renderer
continues to mark profiles unresolved because it does not invoke the new matching API.
Later work must establish definition provenance/completeness, reference and inheritance
policies, and safe profile-driven presentation separately from actual conformance validation.

### Application and remote-data boundary

The synthetic workspace owns one fictional Patient, three Observations (including a
blood-pressure component example), and one Organization, also exported as a native
collection Bundle. Overview observations are selected by the exact local Patient
reference. There is no general reference resolver or remote input boundary yet.
Detail routes use locally unique fixture IDs; before introducing remote/multi-type
records they must use resource type plus ID and server context to avoid collisions.

Compile-time typing does not validate incoming JSON. A future remote/import boundary
must perform runtime FHIR validation before specialized interpretation, including
resource invariants, value choices, profiles, modifier semantics and terminology.
FHIR resource IDs alone are not globally unique. Profile declarations are informational
and remain explicitly unresolved in the existing renderer. Callers can separately match
known local definitions through fhir-core. This is not universal FHIR/profile support.

No authentication, network access, database, server, persistence, cloud services, FHIRPath,
terminology lookup, full profile resolution, or clinical decision support is implemented.
Native distribution and app-store metadata are future work. No .NET project is present.
