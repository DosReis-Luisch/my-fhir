# Integration architecture

Status: design only. This document defines future boundaries; it adds no authentication,
authorization enforcement, networking, imports, storage or device support. The current
wallet uses synthetic resources. See [current architecture](architecture.md),
[product direction](product-direction.md) and the prioritized [backlog](backlog.md).

## Account identity, proofing and patient context

An authenticated account is identified by its trusted issuer and subject together. A
subject from an untrusted issuer is not accepted identity, and an email address is not a
stable account key. Account identity remains separate from FHIR Patient identity.
Authentication demonstrates control of an account; it does not establish medical-record
ownership. Real-world identity proofing, account recovery and record association require
their own assurance policy and accountable authority.

A conceptual account-to-patient binding associates that account with a source-qualified
Patient reference and an approved relationship. Qualification includes source-system
identity and tenant/customer context where applicable. Different servers can use different
logical IDs for the same person; identical IDs can represent different people. A bare
Patient ID, AHV number, insurance identifier, name or date of birth never authorizes access.
Matching attributes can support reviewed reconciliation after proofing, but must not
automatically link accounts or merge identities across systems.

The current authorized patient context identifies the selected source-qualified Patient,
the acting account, the relationship and the applicable grant. One account may have several
approved contexts for self-access or access to other people. Context must scope acquisition
queries, imports, record selection, trends, caches and later synchronization. A selected
context in the UI is not proof of permission: the source or trusted provider-controlled
backend must derive or verify it on every remote request. The existing demo selector is
only display filtering, and the Me tab is not an authenticated account.

An authorized local import has a declared source and patient association, but possession
of a file does not prove identity or confer access to its originating server. Mixed-patient,
missing or ambiguous associations must be held for explicit review rather than silently
assigned to the selected patient. Locally imported content cannot establish a remote grant.

## Authorization relationships and authority

The following relationships are requirements, not implemented controls or legal entitlement.
The source/provider responsible for disclosure approves access under its policies and
applicable rules. An identity provider supplies account identity and any agreed proofing
evidence; it does not automatically grant medical-record access. A matching service can
resolve patient references without becoming the authority for disclosure.

| Relationship                | Approval and evidence                                                                                                | Allowed actions                                                                          | Validity and revocation                                                                                     | Audit requirements                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Self-access                 | Source/provider approves the verified person's association with its Patient record.                                  | Explicit resource categories and read/import actions; writes require a separate grant.   | Defined validity and review after recovery, identity changes or record merges; provider can suspend/revoke. | Record proofing/approval evidence references, binding changes, access decisions and revocations. |
| Guardian/parental authority | Source/provider verifies authority for the dependent; family relationship alone is insufficient.                     | Patient-specific categories/actions reflecting applicable restrictions.                  | Review age transitions and changes in authority; expire or revoke when authority ends.                      | Record authority evidence references, reviewer, dependent context and access decisions.          |
| Delegated caregiver         | Source/provider accepts a valid delegation from an authorized person or process.                                     | Explicit patient, categories, actions and purpose; delegation does not imply all access. | Time-bounded where appropriate; delegator/provider can revoke and delegated authority is rechecked.         | Record delegator, delegate, approval, scope changes and access decisions.                        |
| Verified professional       | Professional identity/credentials and a source-approved care or organizational relationship are verified separately. | Explicit patient/task/purpose; clinical writes need distinct permission and review.      | Recheck credential, employment/care relationship and grant validity; revoke on expiry or withdrawal.        | Record actor, organization/role, patient context, purpose, decision and any reviewed write.      |

Bindings and grants need provider-controlled approval, review and revocation records.
Conceptual evidence includes approver, assurance, source-qualified patient, relationship,
permitted actions, validity and status. This does not select a storage schema or service.
Client assertions must not create or widen these relationships. Refusal, ambiguity and
expired/revoked grants must fail closed. A patient merge or source-ID change requires an
authoritative reconciliation policy; it must not silently transfer access to another person.

### Enforcement across resource paths

The source or trusted gateway must enforce the grant independently of frontend filtering:

- Direct reads verify ownership/authorized association of the requested resource, including
  resources addressed without a patient parameter.
- Searches constrain results to the authorized context; caller-controlled patient filters
  cannot broaden it. Unsupported search forms are rejected rather than passed through.
- Related resources, includes/reverse-includes and contained/reference traversal follow
  explicit rules. Shared Organization or Practitioner context is not a grant to other patients.
- Documents, attachments and Binary downloads require ownership checks even when their IDs
  do not reveal a Patient. Download links must not bypass the grant.
- Bundles require entry-level patient/reference checks and handling of mixed or ambiguous
  content. A Bundle is neither an authorization grant nor permission to execute transactions.
- Continuation links retain the same source, patient and grant restrictions. Validate their
  destination; never forward credentials to arbitrary origins or follow unrestricted links.

A highly privileged application token must never be placed on the phone or combined with
an arbitrary client-selected Patient ID as the access mechanism. A provider gateway using
service credentials must first enforce the human actor's approved grant and then request
only permitted data, preserving trustworthy actor/context information for auditing.

Access auditing must cover allow/deny decisions, grant/binding changes and revocations,
with actor, source/customer context, patient, action, resource reference and correlation.
Avoid tokens and clinical payloads in routine logs. Retention, access to audits and integrity
protection remain decisions for the responsible provider and the later storage design.

## Independent acquisition routes

These routes converge on a safe FHIR R4 acquisition boundary. They need not share an
authentication provider or connection protocol.

| Route                                                        | Responsibilities                                                                                                                        | Limits                                                                                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Local FHIR R4 resources and Bundles                          | Parse untrusted files, bound size/depth, check supported structures, resolve source/patient association and preview import outcomes.    | No remote authorization is inferred; no Bundle transactions, scripts or automatic URL fetching.                                  |
| External FHIR APIs, including SMART                          | Discover supported capabilities, obtain approved authorization, retain patient context and handle resource queries/continuation safely. | SMART is an optional standard adapter; other sources need not implement it. Login alone is not proofing or ownership.            |
| Provider-approved proprietary gateways                       | Use a documented provider contract for binding, grants, patient-scoped retrieval, errors and revocation.                                | No assumed provider approval or production behavior. Do not assume FHIRhouse implements SMART or patient-facing OAuth grants.    |
| HealthKit, Android Health Connect and vendor/device adapters | Obtain platform/source permissions, capture source sample identity and explicitly map supported non-FHIR measurements into R4.          | Device permissions do not grant provider-record access. Platform-specific native bindings/builds stay outside portable packages. |

The application/integration layer owns connection discovery, authentication, token lifecycle,
authorization context and I/O. The acquisition/import boundary owns runtime input checks,
source identity, patient association and repeat-acquisition policy. Full FHIR/profile and
terminology validation are separate capabilities: TypeScript types, profile matching and
snapshot hints do not establish conformance. Unsupported or unsafe input must not enter
specialized interpretation as if validated; define explicit rejection/quarantine/fallback
rules and accurately report the checks performed.

The portable clinical renderer receives eligible native R4 resources and produces disposable
presentation descriptors without modifying originals. Future longitudinal analysis consumes
context-scoped resources and preserves traceability. Both engines remain independent of
identity provider, FHIR server, proprietary gateway, storage, hardware platform and adapter.
Portable FHIR helpers may support analysis without acquiring I/O responsibilities. No
interfaces, packages or infrastructure are introduced by this design.

## Source identity and provenance

Future acquisition must retain these concepts without selecting a persistent database schema:

- Source-system identity, connection origin and tenant/customer partition where applicable.
  For files, preserve declared origin separately from the uploader/import event; unknown
  origin remains unknown rather than being promoted to a trusted clinical source.
- FHIR resource type, logical ID and available version, qualified by source context. Missing
  IDs/versions need an explicit import policy; do not invent authoritative source identifiers.
- The intact original resource, including unknown fields/extensions. Keep any derived views,
  mapping results and local annotations separate; preserve the original payload when needed
  for fidelity, with its storage policy decided later.
- Source-recorded/update timestamps where supplied, acquisition/import timestamps, and
  clinically effective timestamps as distinct values. Preserve partial dates, precision,
  timezone and periods rather than inventing a measurement instant.
- The source-qualified patient association, resolution evidence and applicable import context.
  Non-patient context resources need explicit association rules rather than guessed ownership.
- Repeat-acquisition identity and version handling. Same-source/type/ID/version repeats should
  be idempotent; revisions remain traceable. Content equality alone must not collapse distinct
  clinical events or records across sources. Bundle fullUrl and contained references require
  scoped resolution rather than global bare-ID lookup.
- For mapped device/vendor samples: original sample ID/data, device/source, original units,
  codes and time, mapping/version, transformations and limitations. Reimports must not create
  duplicate measurements; updates/deletions need explicit reconciliation rules.
- Trust distinctions between patient-supplied, device-derived and professionally recorded
  information. Neither transport authentication nor a device label establishes clinical
  verification. Use appropriate FHIR provenance resources where applicable and retain evidence
  rather than inferring trust from a displayed label.

## Storage, lifecycle and synchronization

Before real external patient data, identity verification, enforceable authorization, secure
transport, privacy controls and access auditing are release prerequisites, not later polish.
Synthetic milestones do not demonstrate production readiness.

| Concern                   | Future requirement                                                                                                                                      | Decision deliberately deferred                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Protected local storage   | Protect resources and credentials, isolate accounts/patients and address backups, device loss and logs.                                                 | Storage engine, encryption/key custody and platform-specific backup policy.     |
| Server storage, if needed | Minimize retained data, enforce access and audit, protect keys and backups.                                                                             | Whether MyFHIR needs a backend, hosting/location, retention and key management. |
| Tokens                    | Public-client flows where applicable; protect credentials, define expiry, refresh, rotation, revocation and recovery. Service secrets stay server-side. | Identity provider, token custody and provider-specific grant contracts.         |
| Connection removal        | Stop refresh, cancel pending work, revoke supported grants and distinguish disconnect from deleting retained records.                                   | Provider revocation guarantees and treatment of already downloaded copies.      |
| Patient switching         | Cancel or isolate in-flight acquisition, clear scoped views and prevent stale results/caches from crossing contexts.                                    | Cache/storage partitioning and background-task design.                          |
| Retention/deletion        | Make retained originals, derived data, exports, backups and audit records explicit.                                                                     | User/provider retention rules and deletion propagation guarantees.              |
| Offline access            | Define whether access is permitted, how long, local unlock and grant freshness. Remote revocation cannot recall an offline copy instantly.              | Offline policy and reconciliation when connectivity returns.                    |
| Synchronization           | Preserve versions/provenance; handle retries, deletions and conflicts without silent overwrite or cross-patient merge.                                  | Sync protocol, conflict review and authoritative source rules.                  |

Decide proofing assurance and authority, third-party consent, caregiver/professional evidence,
supported resource/search forms and grant enforcement with each provider before connection
work. Reuse of existing infrastructure is conditional on demonstrated capabilities and
explicit approval; this document contains no integration commitment by any provider.
