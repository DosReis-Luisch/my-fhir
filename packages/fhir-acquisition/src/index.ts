import { ownField, type DiagnosticReport, type Observation, type Patient } from '@myfhir/fhir-core';
import { contentKey, snapshotJson } from './json';

export type SourceQualifiedIdentity = Readonly<{
  sourceNamespace: string;
  resourceType: 'Patient' | 'Observation' | 'DiagnosticReport';
  logicalId: string;
}>;

/** Import consistency context only. Never evidence of identity proofing or authorization. */
export type PatientContext = Readonly<{ sourceNamespace: string; patientId: string }>;

export type DeepReadonly<T> = T extends object
  ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T;

export type AcquiredResource = Readonly<{
  resource: DeepReadonly<Patient | Observation | DiagnosticReport>;
  metadata: InspectionLimits &
    Readonly<{
      identity: SourceQualifiedIdentity;
      versionId: string | undefined;
      patientContext: PatientContext;
    }>;
}>;

export type AcquisitionRequest = Readonly<{
  sourceNamespace: string;
  patientContext: PatientContext;
  /** Synthetic native R4 objects only; unknown forces basic runtime inspection. */
  resource: unknown;
}>;

export type AcquisitionIssue =
  | 'invalid-context'
  | 'source-context-mismatch'
  | 'unsupported-json-input'
  | 'unsupported-resource-type'
  | 'invalid-resource-id'
  | 'invalid-version'
  | 'invalid-observation-shape'
  | 'invalid-diagnostic-report-shape'
  | 'missing-patient-reference'
  | 'ambiguous-patient-reference'
  | 'unsupported-patient-reference'
  | 'patient-context-mismatch';

type InspectionLimits = Readonly<{
  validation: 'basic-guards-only';
  fhirValidation: 'not-performed';
  authorization: 'not-checked';
}>;

export type AcquisitionResult = InspectionLimits &
  (
    | Readonly<{ status: 'acquired' | 'duplicate'; record: AcquiredResource }>
    | Readonly<{ status: 'rejected'; reason: AcquisitionIssue }>
    | Readonly<{
        status: 'conflict';
        reason: 'identity-version-content-conflict';
        existing: AcquiredResource;
      }>
  );

export type AcquisitionStore = Readonly<{
  acquire(request: AcquisitionRequest): AcquisitionResult;
  records(): readonly AcquiredResource[];
}>;

const limits: InspectionLimits = Object.freeze({
  validation: 'basic-guards-only',
  fhirValidation: 'not-performed',
  authorization: 'not-checked',
});
const observationStatuses = new Set([
  'registered',
  'preliminary',
  'final',
  'amended',
  'corrected',
  'cancelled',
  'entered-in-error',
  'unknown',
]);
const diagnosticReportStatuses = new Set([
  'registered',
  'partial',
  'preliminary',
  'final',
  'amended',
  'corrected',
  'appended',
  'cancelled',
  'entered-in-error',
  'unknown',
]);

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && /^[A-Za-z0-9.-]{1,64}$/.test(value);
}

function isNamespace(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Selected CodeableConcept shape only; no terminology or FHIR conformance validation. */
function isReportCode(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { text, coding } = value;
  if (text !== undefined && (typeof text !== 'string' || !text.trim())) return false;
  if (
    coding !== undefined &&
    (!Array.isArray(coding) ||
      !coding.length ||
      !coding.every(
        (entry) =>
          isObject(entry) &&
          typeof entry.code === 'string' &&
          entry.code.trim().length > 0 &&
          (entry.system === undefined ||
            (typeof entry.system === 'string' && entry.system.trim().length > 0)),
      ))
  ) {
    return false;
  }
  return text !== undefined || coding !== undefined;
}

function associationIssue(
  resource: Record<string, unknown>,
  patientId: string,
): AcquisitionIssue | null {
  if (resource.resourceType === 'Patient') {
    return resource.id === patientId ? null : 'patient-context-mismatch';
  }
  const subject = resource.subject;
  if (subject === undefined) return 'missing-patient-reference';
  if (!isObject(subject)) return 'ambiguous-patient-reference';
  // An identifier is another possible identity assertion; do not reconcile it by guessing.
  if (Object.hasOwn(subject, 'identifier')) return 'ambiguous-patient-reference';
  if (subject.reference === undefined) return 'missing-patient-reference';
  if (subject.type !== undefined && subject.type !== 'Patient') {
    return 'unsupported-patient-reference';
  }
  if (typeof subject.reference !== 'string') return 'ambiguous-patient-reference';
  // Relative, unversioned references only, resolved strictly within request.sourceNamespace.
  const match = /^Patient\/([A-Za-z0-9.-]{1,64})$/.exec(subject.reference);
  if (!match || match[0] !== subject.reference) return 'unsupported-patient-reference';
  return match[1] === patientId ? null : 'patient-context-mismatch';
}

/** In-memory synthetic acquisition only. No renderer invocation, I/O or authorization. */
export function createAcquisitionStore(): AcquisitionStore {
  const entries = new Map<string, { record: AcquiredResource; content: string }>();

  return Object.freeze({
    acquire(request: AcquisitionRequest): AcquisitionResult {
      const reject = (reason: AcquisitionIssue): AcquisitionResult =>
        Object.freeze({ ...limits, status: 'rejected', reason });
      const sourceNamespace = ownField(request, 'sourceNamespace');
      const context = ownField(request, 'patientContext');
      const contextSource = ownField(context, 'sourceNamespace');
      const patientId = ownField(context, 'patientId');
      if (!isNamespace(sourceNamespace) || !isNamespace(contextSource) || !isId(patientId)) {
        return reject('invalid-context');
      }
      if (sourceNamespace !== contextSource) return reject('source-context-mismatch');

      let snapshot: unknown;
      try {
        snapshot = snapshotJson(ownField(request, 'resource'));
      } catch {
        return reject('unsupported-json-input');
      }
      if (!isObject(snapshot)) return reject('unsupported-resource-type');
      const { resourceType, id, meta } = snapshot;
      if (
        resourceType !== 'Patient' &&
        resourceType !== 'Observation' &&
        resourceType !== 'DiagnosticReport'
      ) {
        return reject('unsupported-resource-type');
      }
      if (!isId(id)) return reject('invalid-resource-id');
      if (meta !== undefined && !isObject(meta)) return reject('invalid-version');
      const versionId = ownField(meta, 'versionId');
      if (versionId !== undefined && !isId(versionId)) return reject('invalid-version');
      if (
        resourceType === 'Observation' &&
        (typeof snapshot.status !== 'string' ||
          !observationStatuses.has(snapshot.status) ||
          !isObject(snapshot.code))
      ) {
        return reject('invalid-observation-shape');
      }
      if (
        resourceType === 'DiagnosticReport' &&
        (typeof snapshot.status !== 'string' ||
          !diagnosticReportStatuses.has(snapshot.status) ||
          !isReportCode(snapshot.code))
      ) {
        return reject('invalid-diagnostic-report-shape');
      }
      const issue = associationIssue(snapshot, patientId);
      if (issue) return reject(issue);

      const identity = Object.freeze({ sourceNamespace, resourceType, logicalId: id });
      // A tuple encoding avoids delimiter collisions. Absent version is distinct from any string.
      const key = JSON.stringify([sourceNamespace, resourceType, id, versionId ?? null]);
      const content = contentKey(snapshot);
      const previous = entries.get(key);
      if (previous) {
        return previous.content === content
          ? Object.freeze({ ...limits, status: 'duplicate', record: previous.record })
          : Object.freeze({
              ...limits,
              status: 'conflict',
              reason: 'identity-version-content-conflict',
              existing: previous.record,
            });
      }
      const record: AcquiredResource = Object.freeze({
        // Basic structural inspection is deliberately not full FHIR validation.
        resource: snapshot as unknown as DeepReadonly<Patient | Observation | DiagnosticReport>,
        metadata: Object.freeze({
          ...limits,
          identity,
          versionId,
          patientContext: Object.freeze({ sourceNamespace: contextSource, patientId }),
        }),
      });
      entries.set(key, { record, content });
      return Object.freeze({ ...limits, status: 'acquired', record });
    },
    records(): readonly AcquiredResource[] {
      return Object.freeze(Array.from(entries.values(), (entry) => entry.record));
    },
  });
}
