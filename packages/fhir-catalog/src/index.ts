import type { AcquiredResource, PatientContext } from '@myfhir/fhir-acquisition';
import { ownField } from '@myfhir/fhir-core';
import type { QuantitySeries } from '@myfhir/fhir-longitudinal';

export const observationCategorySystem =
  'http://terminology.hl7.org/CodeSystem/observation-category';
export type ClinicalCategory = 'vital-signs' | 'laboratory' | 'unclassified';
export type ClassificationReason =
  | 'explicit-category'
  | 'patient-context-resource'
  | 'missing-category'
  | 'unsupported-category'
  | 'ambiguous-category'
  | 'modifier-extension';
export type CatalogCapability = 'original-resource' | 'renderer-presentation' | 'numerical-history';
export type ClassificationEvidence = Readonly<{
  path: string;
  system: string | undefined;
  code: string | undefined;
  version: string | undefined;
}>;
/** Supplied reference assertion only: no target, traversal, ownership or resolution inferred. */
export type CatalogRelationship = Readonly<{
  path: string;
  reference: string | undefined;
  sourceContext: PatientContext;
  resolution: 'unresolved';
  reason: 'resolution-not-implemented' | 'unsupported-reference';
}>;
export type CatalogItem = Readonly<{
  key: string;
  record: AcquiredResource;
  identity: AcquiredResource['metadata']['identity'];
  versionId: string | undefined;
  patientContext: PatientContext;
  resource: AcquiredResource['resource'];
  resourceType: AcquiredResource['metadata']['identity']['resourceType'];
  category: ClinicalCategory;
  reason: ClassificationReason;
  evidence: readonly ClassificationEvidence[];
  limitations: readonly string[];
  capabilities: readonly CatalogCapability[];
  relationships: readonly CatalogRelationship[];
}>;
export type CatalogGroup = Readonly<{
  category: ClinicalCategory;
  label: string;
  items: readonly CatalogItem[];
}>;
export type ClinicalCatalog = Readonly<{
  patientContext: PatientContext;
  items: readonly CatalogItem[];
  groups: readonly CatalogGroup[];
  exclusions: readonly Readonly<{ record: AcquiredResource; reason: 'context-mismatch' }>[];
  historySections: readonly Readonly<{
    kind: 'numerical' | 'other-history';
    label: string;
    status: 'available' | 'unavailable' | 'planned';
    items: readonly CatalogItem[];
  }>[];
  limitations: readonly string[];
  validation: 'not-performed';
  authorization: 'not-checked';
}>;

const limitations = Object.freeze([
  'Selected category metadata only; no FHIR, profile, terminology or clinical validation.',
  'Context filtering is consistency, not authorization or cross-source patient matching.',
  'No latest-version selection, relationship resolution, external fetching or persistence.',
  'Category does not imply safe interpretation or numerical eligibility; renderer/analysis policies apply.',
]);
const categories = ['vital-signs', 'laboratory', 'unclassified'] as const;
const labels = {
  'vital-signs': 'Vital signs and body measurements',
  laboratory: 'Laboratory results',
  unclassified: 'Other / unclassified clinical records',
};
function sameContext(a: PatientContext, b: PatientContext): boolean {
  return a.sourceNamespace === b.sourceNamespace && a.patientId === b.patientId;
}
function hasModifier(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const modifier = ownField(value, 'modifierExtension');
  return (
    (Object.hasOwn(value, 'modifierExtension') &&
      (!Array.isArray(modifier) || modifier.length > 0)) ||
    Object.values(value).some(hasModifier)
  );
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
function classify(record: AcquiredResource) {
  const evidence: ClassificationEvidence[] = [];
  const raw: unknown = ownField(record.resource, 'category');
  let unsupported = false;
  if (Array.isArray(raw)) {
    raw.forEach((concept, i) => {
      const coding = ownField(concept, 'coding');
      if (!Array.isArray(coding) || !coding.length) unsupported = true;
      else {
        coding.forEach((entry, j) => {
          const system = text(ownField(entry, 'system'));
          const code = text(ownField(entry, 'code'));
          const version = text(ownField(entry, 'version'));
          evidence.push(
            Object.freeze({ path: `category[${i}].coding[${j}]`, system, code, version }),
          );
          if (
            system !== observationCategorySystem ||
            (code !== 'vital-signs' && code !== 'laboratory') ||
            ownField(entry, 'version') !== undefined
          ) {
            unsupported = true;
          }
        });
      }
    });
  }
  const codes = new Set(evidence.map((entry) => entry.code));
  let category: ClinicalCategory = 'unclassified';
  let reason: ClassificationReason;
  if (hasModifier(record.resource)) reason = 'modifier-extension';
  else if (record.resource.resourceType === 'Patient') reason = 'patient-context-resource';
  else if (codes.size > 1) reason = 'ambiguous-category';
  else if (unsupported || (raw !== undefined && !Array.isArray(raw)))
    reason = 'unsupported-category';
  else if (!evidence.length) reason = 'missing-category';
  else {
    reason = 'explicit-category';
    category = evidence[0]!.code as 'vital-signs' | 'laboratory';
  }
  return { category, reason, evidence: Object.freeze(evidence) };
}
function relationships(record: AcquiredResource): readonly CatalogRelationship[] {
  if (record.resource.resourceType !== 'Observation') return Object.freeze([]);
  const result: CatalogRelationship[] = [];
  for (const field of [
    'subject',
    'derivedFrom',
    'hasMember',
    'basedOn',
    'partOf',
    'specimen',
    'encounter',
    'device',
    'performer',
    'focus',
  ]) {
    const value = ownField(record.resource, field);
    if (value === undefined) continue;
    const entries = Array.isArray(value) ? value : [value];
    entries.forEach((entry, index) => {
      const reference = text(ownField(entry, 'reference'));
      result.push(
        Object.freeze({
          path: Array.isArray(value) ? `${field}[${index}]` : field,
          reference,
          sourceContext: record.metadata.patientContext,
          resolution: 'unresolved',
          reason: reference ? 'resolution-not-implemented' : 'unsupported-reference',
        }),
      );
    });
  }
  return Object.freeze(result);
}

/** Accept only acquisition snapshots. Series evidence must come from the longitudinal engine. */
export function buildClinicalCatalog(
  records: readonly AcquiredResource[],
  patientContext: PatientContext,
  histories: readonly QuantitySeries[] = [],
): ClinicalCatalog {
  if (
    !patientContext.sourceNamespace ||
    patientContext.sourceNamespace.trim() !== patientContext.sourceNamespace ||
    !/^[A-Za-z0-9.-]{1,64}$/.test(patientContext.patientId)
  ) {
    throw new RangeError('Explicit source-qualified patient context is required.');
  }
  const context = Object.freeze({ ...patientContext });
  const numerical = new Set(
    histories
      .filter((series) => sameContext(series.patientContext, context))
      .flatMap((series) => series.points.map((point) => point.record)),
  );
  const items: CatalogItem[] = [];
  const exclusions: { record: AcquiredResource; reason: 'context-mismatch' }[] = [];
  const seen = new Set<AcquiredResource>();
  for (const record of records) {
    if (seen.has(record)) continue;
    seen.add(record);
    const { identity, versionId } = record.metadata;
    if (
      identity.sourceNamespace !== context.sourceNamespace ||
      !sameContext(record.metadata.patientContext, context)
    ) {
      exclusions.push(Object.freeze({ record, reason: 'context-mismatch' }));
      continue;
    }
    const capabilities: CatalogCapability[] = ['original-resource', 'renderer-presentation'];
    if (numerical.has(record)) capabilities.push('numerical-history');
    items.push(
      Object.freeze({
        key: JSON.stringify([
          identity.sourceNamespace,
          identity.resourceType,
          identity.logicalId,
          versionId ?? null,
        ]),
        record,
        identity,
        versionId,
        patientContext: record.metadata.patientContext,
        resource: record.resource,
        resourceType: identity.resourceType,
        ...classify(record),
        limitations,
        capabilities: Object.freeze(capabilities),
        relationships: relationships(record),
      }),
    );
  }
  items.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const groups = categories
    .map((category) =>
      Object.freeze({
        category,
        label: labels[category],
        items: Object.freeze(
          items.filter((item) => item.category === category && item.resourceType === 'Observation'),
        ),
      }),
    )
    .filter((group) => group.items.length > 0);
  const numericalItems = Object.freeze(
    items.filter((item) => item.capabilities.includes('numerical-history')),
  );
  return Object.freeze({
    patientContext: context,
    items: Object.freeze(items),
    groups: Object.freeze(groups),
    exclusions: Object.freeze(exclusions),
    limitations,
    historySections: Object.freeze([
      Object.freeze({
        kind: 'numerical' as const,
        label: 'Numerical measurement histories',
        status: numericalItems.length ? ('available' as const) : ('unavailable' as const),
        items: numericalItems,
      }),
      Object.freeze({
        kind: 'other-history' as const,
        label: 'Other historical clinical information',
        status: 'planned' as const,
        items: Object.freeze([]),
      }),
    ]),
    validation: 'not-performed',
    authorization: 'not-checked',
  });
}
