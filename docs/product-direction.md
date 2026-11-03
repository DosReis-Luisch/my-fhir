# Product direction

See [integration architecture](integration-architecture.md) for the detailed future identity,
authorization, acquisition and lifecycle boundaries, and the [product backlog](backlog.md) for
priority, dependencies and acceptance criteria. The backlog records Phase 2A as merged, with
final device navigation verification remaining a follow-up check. Future capabilities below
remain design direction, not implemented integrations.

## Patient-first, not patient-only

MyFHIR starts as a FHIR-native personal health wallet: patients should be able to understand
their information and inspect its source. The reusable engine should also support future
clinician, nurse and hospital workspaces. Phase 2A provides only Home, Records and Me over
fictional data. It has no live connections, accounts, permissions, sharing or clinical writes.

Future professional workspaces need verified professional identity and separately authorized
patient access. A professional role label alone must never enable a write. Any later clinical
write flow needs scoped permissions, appropriate review, provenance and an audit trail;
none of these controls is implemented by the current demo.

## Identity and authorized access are separate

- **Account identity** identifies the person authenticated to an application. The Me tab
  currently shows a synthetic patient context, not an authenticated account. An account is
  not equivalent to a Patient, RelatedPerson, Practitioner or PractitionerRole resource.
- **Patient identity** identifies the subject of a FHIR clinical record. A person can have
  different Patient identities across systems; linking them requires explicit, authorized
  identity reconciliation. A matching name or local ID is insufficient.
- **Professional identity** describes a healthcare professional, potentially represented by
  a Practitioner and related FHIR resources. A Practitioner resource does not itself verify
  credentials or grant access to any Patient.
- **Authorization** decides who may act on which records, for what purpose and scope.
  Account-to-patient links, delegated access, professional verification and patient-authorized
  sharing need independent policies. Possession or display of a resource is not permission.

One authenticated person may be associated with several FHIR Patient records, whether for
their own care across systems or for authorized care of other people. Personal health access,
parental/guardian access, delegated caregiver access and verified professional access are
separate authorization relationships. A caregiver may manage children or other authorized
dependents; family relationships alone do not establish authority. Future access policies must
establish that authority and account for jurisdiction, patient age and circumstances. These
are design requirements, not implemented controls or a statement of legal entitlement.

A professional role alone must not grant access to arbitrary patients. Future patient-context
switching must scope all clinical data, history, visualizations and imports to the selected,
authorized Patient context. Identity links must not silently merge different patients' records.
Patient switching, account infrastructure and access grants are outside Phase 2A.

## Phase 2B direction: longitudinal FHIR information

Plan historical views across multiple Observation resources, grouped using clinically meaningful
coding and context, with graphs offering selectable time ranges. Grouping must check unit
compatibility and handle incomparable observations explicitly rather than combining them into
misleading series. Preserve traceability to each original resource and its provenance.

Future FHIR R4 import and Bundle ingestion must respect the authorized patient context and
preserve source resources. Longitudinal extraction, charting and ingestion are planned work;
none is implemented in this refinement. The Home snapshot is only a small selection in demo
order, not a latest-result selection or a historical summary.

## Future adapters, outside the rendering engine

[SMART on FHIR](https://hl7.org/fhir/smart-app-launch/) is a future authorization and
interoperability adapter for external FHIR systems. Connection discovery, user authorization,
scopes, token lifecycle and launch context belong at that integration boundary. Successful
authorization does not establish clinical correctness, complete history or local permissions
for other actions. There is no SMART/OAuth implementation in MyFHIR today.

[Apple HealthKit](https://developer.apple.com/documentation/healthkit),
[Android Health Connect](https://developer.android.com/health-and-fitness/health-connect)
and device/vendor interfaces are possible future ingestion adapters. Wearables commonly
provide non-FHIR samples, vendor JSON or device-specific payloads: they require explicit,
reviewable mapping into native FHIR. Some source interfaces can supply FHIR medical records;
do not assume either that every payload needs conversion or that all health data is FHIR.
Mappings must address patient association, codes, units, measurement time, source identity,
quality limits and duplicate handling without silently inventing clinical meaning.

Native HealthKit/Health Connect bindings, permissions and entitlements require a custom
development build rather than plain Expo Go. Expo Go has a fixed native runtime; see
[Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).
No native health libraries, Bluetooth functionality, generated native projects or platform
permissions are added in Phase 2A. These adapters are future capabilities, not current support.

## Provenance, validation and trust

Preserve native FHIR resources and their source identity. Future ingestion must retain
original values/units, clinically effective time versus recording time, device/provider
origin, authorship and mapping history. Patient-entered, device-derived and professionally
recorded information must remain distinguishable. Provenance should be explicit, using
appropriate FHIR resources where applicable, rather than inferred from display labels.

Displaying FHIR is different from trusting or validating it. The current renderer safely
summarizes selected fields; local profile resolution and snapshot hints do not establish
FHIR conformance, clinical accuracy, normality or snapshot completeness. Future structural,
profile and terminology checks remain distinct from clinical review and provenance trust.
Keep source adapters outside fhir-core/fhir-renderer; the renderer must not depend on where
data was obtained. No proprietary persistent clinical DTO model is introduced.

Before real data or external access, reassess dependency findings, runtime input validation,
secure transport/storage, token protection, account verification, scoped authorization,
sharing/revocation and audit boundaries. The current synthetic demo demonstrates no production
privacy or authorization guarantees. See [architecture](architecture.md) and the existing
[dependency assessment](security/dependency-audit.md) for implementation limits.
