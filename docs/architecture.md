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

- Patient: supplied name, date of birth, administrative gender.
- Observation: supplied code text/display, quantity (including comparator and unit),
  coded display, string, boolean, integer, supported components, effectiveDateTime and
  status. Zero and false are retained. No terminology-based inference or unit conversion.
- Other R4 resource types: type and logical identity, with an explicit fallback notice.
- Modifier extensions anywhere in a resource: conservative generic fallback, because
  ignoring them could change clinical meaning.
- Cancelled or entered-in-error observations: generic fallback with explicit status;
  result values are withheld from the summary. Other statuses remain visible in details.

All summaries state that only selected fields are shown. Unknown fields, extensions,
unsupported value choices and declared profiles remain in the original resource and
are not promoted into interpreted clinical facts. The details screen can expose that
source as plain text JSON. Resource narratives are never rendered as executable HTML.
Missing/unsupported values are labelled unavailable, not assigned a clinical meaning.
Source paths identify summarized elements, not a complete coverage or FHIRPath model.
Dates retain source precision/timezone rather than inventing a time or converting a
partial date. No normality classification or medical advice is inferred.

## Current boundary and limitations

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
and are explicitly marked unresolved. This is not universal FHIR/profile support.

No authentication, network access, database, server, persistence, cloud services, FHIRPath,
terminology lookup, full profile resolution, or clinical decision support is implemented.
Native distribution and app-store metadata are future work. No .NET project is present.
