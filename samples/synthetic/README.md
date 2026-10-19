# Synthetic R4 examples

All identities and measurements are fictional and hand-authored for MyFHIR. No clinical
exports, production identifiers, addresses, or credentials are used. Example URLs use
the reserved `.example` domain and are not resolvable services.

`src/patient.ts` and `src/observations.ts` contain native FHIR R4 resource literals checked
against shared R4 types. `src/index.ts` also exposes an Organization to demonstrate generic
fallback and a native collection Bundle. The literals are TypeScript source, not JSON files;
the exported Bundle can be serialized without conversion to another clinical model.

The Patient includes an ordinary extension deliberately left uninterpreted. Terminology
labels and units are supplied in the resources. No profile compliance or full FHIR validation
is claimed. Do not replace these fixtures with real patient data.

Phase 1A exports `syntheticPulseProfile` and `syntheticPulseObservation` from
`src/vitalSignProfile.ts`. The draft, experimental R4 StructureDefinition constrains a
fictional pulse Observation with a small curated snapshot: status, LOINC heart-rate code,
Patient subject, clinically effective dateTime and Quantity result. Its URL is
`https://myfhir.example/StructureDefinition/synthetic-pulse`, version `1.0.0`; the example
Observation declares the exact `url|version` in `meta.profile`.

These exports deliberately remain outside the patient overview's existing resources
and Bundle. The snapshot contains selected elements, not the complete inherited R4
Observation structure. It is suitable for metadata inspection, not production validation
or a published implementation guide. Matching the declaration never establishes conformance.
