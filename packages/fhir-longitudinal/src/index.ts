import type { AcquiredResource, PatientContext } from '@myfhir/fhir-acquisition';
import { ownField } from '@myfhir/fhir-core';
import { effectiveInstant } from './time';

export type CodingSelection = Readonly<{ system: string; code: string }>;
export type QuantitySeriesRequest = Readonly<{
  patientContext: PatientContext;
  /** One exact coding and one explicitly supported coded unit per analysis. */
  measurement: Readonly<{ coding: CodingSelection; unit: CodingSelection }>;
}>;
export type MeasurementPoint = Readonly<{
  value: number;
  effectiveDateTime: string;
  /** Exact original acquired object, including source identity/version and native resource. */
  record: AcquiredResource;
}>;
export type ExclusionReason =
  | 'not-observation'
  | 'source-mismatch'
  | 'patient-mismatch'
  | 'multiple-retained-versions'
  | 'repeated-observation-identity'
  | 'modifier-extension'
  | 'unsupported-status'
  | 'coding-mismatch-or-ambiguity'
  | 'unsupported-measurement-context'
  | 'unsupported-value-form'
  | 'missing-or-nonnumeric-value'
  | 'comparator-not-exact'
  | 'unit-mismatch'
  | 'missing-effective-time'
  | 'unsupported-effective-time';
export type ObservationExclusion = Readonly<{ record: AcquiredResource; reason: ExclusionReason }>;
export type QuantitySeries = Readonly<{
  measurement: QuantitySeriesRequest['measurement'];
  patientContext: PatientContext;
  points: readonly MeasurementPoint[];
  exclusions: readonly ObservationExclusion[];
  limitations: readonly string[];
  validation: 'selection-guards-only';
  authorization: 'not-checked';
}>;

const limitations = Object.freeze([
  'Synthetic acquired resources only; selection guards are not full FHIR/profile/clinical validation.',
  'Source/patient filtering checks analysis consistency, not authorization or real-world identity.',
  'Exactly one coding and coded unit; no terminology inference, unit conversion or context reconciliation.',
  'Final status only; no current-version inference or automatic reconciliation of retained revisions.',
  'Full effectiveDateTime with seconds and known offset only; at most three fractional digits.',
  'No clinical comparability, reference-range, normality, diagnosis or treatment conclusions.',
  'Disposable analysis only; no renderer, graph, persistence, network or authentication integration.',
]);

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasModifier(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const modifier = ownField(value, 'modifierExtension');
  if (
    Object.hasOwn(value, 'modifierExtension') &&
    (!Array.isArray(modifier) || modifier.length > 0)
  ) {
    return true;
  }
  return Object.values(value).some(hasModifier);
}

function identityKey(record: AcquiredResource): string {
  const { sourceNamespace, resourceType, logicalId } = record.metadata.identity;
  return JSON.stringify([sourceNamespace, resourceType, logicalId]);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function exclusionKey(exclusion: ObservationExclusion): string {
  return JSON.stringify([
    identityKey(exclusion.record),
    exclusion.record.metadata.versionId ?? null,
    exclusion.reason,
    exclusion.record.resource,
  ]);
}

/** Pure selection over immutable acquisition snapshots. Invalid selection throws RangeError. */
export function analyzeQuantitySeries(
  records: readonly AcquiredResource[],
  request: QuantitySeriesRequest,
): QuantitySeries {
  const context = Object.freeze({ ...request.patientContext });
  const coding = Object.freeze({ ...request.measurement.coding });
  const unit = Object.freeze({ ...request.measurement.unit });
  if (
    ![
      context.sourceNamespace,
      context.patientId,
      coding.system,
      coding.code,
      unit.system,
      unit.code,
    ].every((value) => typeof value === 'string' && value.length > 0 && value.trim() === value) ||
    !/^[A-Za-z0-9.-]{1,64}$/.test(context.patientId)
  ) {
    throw new RangeError('Explicit source/patient context, coding and coded unit are required.');
  }

  // Inspect identities across the entire supplied collection BEFORE context/status/code selection.
  // An older/out-of-context revision must not make another revision look authoritative.
  const identities = new Map<string, { count: number; versions: Set<string | undefined> }>();
  for (const record of records) {
    if (record.resource.resourceType !== 'Observation') continue;
    const key = identityKey(record);
    const group = identities.get(key) ?? { count: 0, versions: new Set<string | undefined>() };
    group.count++;
    group.versions.add(record.metadata.versionId);
    identities.set(key, group);
  }
  const points: { point: MeasurementPoint; instant: number }[] = [];
  const exclusions: ObservationExclusion[] = [];
  for (const record of records) {
    const reject = (reason: ExclusionReason) => exclusions.push(Object.freeze({ record, reason }));
    const resource = record.resource;
    if (
      record.metadata.identity.sourceNamespace !== context.sourceNamespace ||
      record.metadata.patientContext.sourceNamespace !== context.sourceNamespace
    ) {
      reject('source-mismatch');
      continue;
    }
    if (record.metadata.patientContext.patientId !== context.patientId) {
      reject('patient-mismatch');
      continue;
    }
    if (resource.resourceType !== 'Observation') {
      reject('not-observation');
      continue;
    }
    if (resource.subject?.reference !== `Patient/${context.patientId}`) {
      reject('patient-mismatch');
      continue;
    }
    const revisions = identities.get(identityKey(record))!;
    if (revisions.count > 1) {
      reject(
        revisions.versions.size > 1
          ? 'multiple-retained-versions'
          : 'repeated-observation-identity',
      );
      continue;
    }
    if (hasModifier(resource)) {
      reject('modifier-extension');
      continue;
    }
    if (resource.status !== 'final') {
      reject('unsupported-status');
      continue;
    }
    const codings: unknown = ownField(resource.code, 'coding');
    if (
      !Array.isArray(codings) ||
      codings.length !== 1 ||
      ownField(codings[0], 'system') !== coding.system ||
      ownField(codings[0], 'code') !== coding.code ||
      ownField(codings[0], 'version') !== undefined
    ) {
      reject('coding-mismatch-or-ambiguity');
      continue;
    }
    if (['specimen', 'method', 'bodySite'].some((key) => Object.hasOwn(resource, key))) {
      reject('unsupported-measurement-context');
      continue;
    }
    if (
      Object.hasOwn(resource, 'component') ||
      Object.hasOwn(resource, 'dataAbsentReason') ||
      Object.keys(resource).some((key) => /^value[A-Z]/.test(key) && key !== 'valueQuantity')
    ) {
      reject('unsupported-value-form');
      continue;
    }
    const quantity: unknown = resource.valueQuantity;
    const value = ownField(quantity, 'value');
    if (!object(quantity) || typeof value !== 'number' || !Number.isFinite(value)) {
      reject('missing-or-nonnumeric-value');
      continue;
    }
    if (Object.hasOwn(quantity, 'comparator')) {
      reject('comparator-not-exact');
      continue;
    }
    if (quantity.system !== unit.system || quantity.code !== unit.code) {
      reject('unit-mismatch');
      continue;
    }
    const time: unknown = resource.effectiveDateTime;
    if (
      Object.keys(resource).some(
        (key) => /^effective[A-Z]/.test(key) && key !== 'effectiveDateTime',
      )
    ) {
      reject('unsupported-effective-time');
      continue;
    }
    if (time === undefined) {
      reject('missing-effective-time');
      continue;
    }
    const instant = effectiveInstant(time);
    if (instant === undefined || typeof time !== 'string') {
      reject('unsupported-effective-time');
      continue;
    }
    points.push({ instant, point: Object.freeze({ value, effectiveDateTime: time, record }) });
  }
  points.sort(
    (a, b) =>
      a.instant - b.instant ||
      compare(a.point.effectiveDateTime, b.point.effectiveDateTime) ||
      compare(identityKey(a.point.record), identityKey(b.point.record)),
  );
  exclusions.sort((a, b) => compare(exclusionKey(a), exclusionKey(b)));
  return Object.freeze({
    measurement: Object.freeze({ coding, unit }),
    patientContext: context,
    points: Object.freeze(points.map((entry) => entry.point)),
    exclusions: Object.freeze(exclusions),
    limitations,
    validation: 'selection-guards-only',
    authorization: 'not-checked',
  });
}
