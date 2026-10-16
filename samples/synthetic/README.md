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
