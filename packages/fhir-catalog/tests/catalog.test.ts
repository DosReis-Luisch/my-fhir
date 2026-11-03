import { describe, expect, it } from 'vitest';
import { createAcquisitionStore } from '@myfhir/fhir-acquisition';
import type { Observation } from '@myfhir/fhir-core';
import { analyzeQuantitySeries } from '@myfhir/fhir-longitudinal';
import { buildClinicalCatalog, observationCategorySystem } from '../src/index';

const context = { sourceNamespace: 'synthetic:catalog-a', patientId: 'fictional-person' };
function observation(fields: Partial<Observation> = {}): Observation {
  return {
    resourceType: 'Observation',
    id: 'fictional-measurement',
    status: 'final',
    subject: { reference: `Patient/${context.patientId}` },
    code: { coding: [{ system: 'http://loinc.org', code: '29463-7' }] },
    effectiveDateTime: '2026-10-01T08:00:00Z',
    valueQuantity: { value: 72.4, system: 'http://unitsofmeasure.org', code: 'kg' },
    ...fields,
  };
}
function category(...codes: string[]) {
  return [{ coding: codes.map((code) => ({ system: observationCategorySystem, code })) }];
}
function acquire(resources: readonly unknown[]) {
  const store = createAcquisitionStore();
  for (const resource of resources) {
    const result = store.acquire({
      sourceNamespace: context.sourceNamespace,
      patientContext: context,
      resource,
    });
    if (result.status !== 'acquired') throw new Error('Invalid synthetic fixture');
  }
  return store.records();
}

describe('portable clinical catalog', () => {
  it('groups only exact supported codes; duplicate agreeing codings do not duplicate a record', () => {
    const records = acquire([
      observation({ id: 'vital', category: category('vital-signs', 'vital-signs') }),
      observation({ id: 'lab', category: category('laboratory') }),
    ]);
    const catalog = buildClinicalCatalog(records, context);
    expect(catalog.groups.map((group) => [group.category, group.items.length])).toEqual([
      ['vital-signs', 1],
      ['laboratory', 1],
    ]);
    expect(
      catalog.items.find((item) => item.identity.logicalId === 'vital')?.evidence,
    ).toHaveLength(2);
    expect(catalog.items.every((item) => item.reason === 'explicit-category')).toBe(true);
    expect(Object.isFrozen(catalog.items[0]?.evidence[0])).toBe(true);
  });

  it('retains missing, conflicting, unknown, text-only and versioned categories as unclassified', () => {
    const records = acquire([
      observation({ id: 'missing' }),
      observation({ id: 'ambiguous', category: category('vital-signs', 'laboratory') }),
      observation({
        id: 'separate-concepts',
        category: [...category('vital-signs'), ...category('laboratory')],
      }),
      observation({ id: 'unknown', category: category('not-supported') }),
      observation({ id: 'mixed', category: category('vital-signs', 'not-supported') }),
      observation({ id: 'text', category: [{ text: 'Vital signs laboratory' }] }),
      observation({
        id: 'foreign',
        category: [{ coding: [{ system: 'urn:wrong', code: 'vital-signs' }] }],
      }),
      observation({
        id: 'versioned',
        category: [
          {
            coding: [
              {
                system: observationCategorySystem,
                code: 'vital-signs',
                version: 'future',
              },
            ],
          },
        ],
      }),
    ]);
    const catalog = buildClinicalCatalog(records, context);
    expect(catalog.groups).toHaveLength(1);
    expect(catalog.groups[0]?.category).toBe('unclassified');
    expect(catalog.groups[0]?.items).toHaveLength(records.length);
    const reason = (id: string) =>
      catalog.items.find((item) => item.identity.logicalId === id)?.reason;
    expect(reason('ambiguous')).toBe('ambiguous-category');
    expect(reason('separate-concepts')).toBe('ambiguous-category');
    expect(reason('missing')).toBe('missing-category');
    expect(reason('foreign')).toBe('unsupported-category');
    expect(reason('versioned')).toBe('unsupported-category');
  });

  it('withholds category interpretation for modifiers, retaining unsupported clinical forms', () => {
    const stringValue = observation({ id: 'string', category: category('laboratory') });
    delete stringValue.valueQuantity;
    stringValue.valueString = 'fictional';
    const catalog = buildClinicalCatalog(
      acquire([
        observation({
          id: 'modifier',
          category: category('vital-signs'),
          modifierExtension: [{ url: 'urn:fictional:modifier', valueBoolean: true }],
        }),
        stringValue,
      ]),
      context,
    );
    expect(catalog.items.find((item) => item.identity.logicalId === 'modifier')?.reason).toBe(
      'modifier-extension',
    );
    expect(catalog.items).toHaveLength(2);
    expect(catalog.items.every((item) => !item.capabilities.includes('numerical-history'))).toBe(
      true,
    );
  });

  it('isolates sources and patients even when logical IDs match', () => {
    const store = createAcquisitionStore();
    for (const patientContext of [
      context,
      { ...context, sourceNamespace: 'synthetic:catalog-b' },
      { ...context, patientId: 'another-person' },
    ]) {
      store.acquire({
        sourceNamespace: patientContext.sourceNamespace,
        patientContext,
        resource: observation({
          subject: { reference: `Patient/${patientContext.patientId}` },
          meta: { versionId: patientContext.patientId === context.patientId ? '1' : '2' },
        }),
      });
    }
    const catalog = buildClinicalCatalog(store.records(), context);
    expect(catalog.items).toHaveLength(1);
    expect(catalog.exclusions).toHaveLength(2);
    const other = buildClinicalCatalog(store.records(), {
      ...context,
      sourceNamespace: 'synthetic:catalog-b',
    });
    expect(other.items[0]?.identity.logicalId).toBe(catalog.items[0]?.identity.logicalId);
    expect(other.items[0]?.key).not.toBe(catalog.items[0]?.key);
    expect(catalog.authorization).toBe('not-checked');
  });

  it('preserves native snapshots, unknown fields, versions and explicit unresolved relationships', () => {
    const original = {
      ...observation({
        meta: { versionId: 'v1' },
        derivedFrom: [{ reference: 'DiagnosticReport/fictional-report' }],
        hasMember: [{ identifier: { value: 'unresolved' } }],
      }),
      unknownField: { preserved: true },
    };
    const before = JSON.stringify(original);
    const records = acquire([
      original,
      { ...original, meta: { versionId: 'v2' } },
      { resourceType: 'Patient', id: context.patientId },
    ]);
    const catalog = buildClinicalCatalog(records, context);
    expect(catalog.items).toHaveLength(3);
    const item = catalog.items.find((entry) => entry.versionId === 'v1')!;
    expect(item.record).toBe(records[0]);
    expect(item.resource).toBe(records[0]?.resource);
    expect(item.resource).toEqual(original);
    expect(JSON.stringify(original)).toBe(before);
    expect(Object.isFrozen(original)).toBe(false);
    expect(item.relationships).toContainEqual(
      expect.objectContaining({
        reference: 'DiagnosticReport/fictional-report',
        resolution: 'unresolved',
        sourceContext: context,
      }),
    );
    expect(item.relationships).toContainEqual(
      expect.objectContaining({
        path: 'hasMember[0]',
        reason: 'unsupported-reference',
      }),
    );
    expect(catalog.items.find((entry) => entry.resourceType === 'Patient')?.reason).toBe(
      'patient-context-resource',
    );
    expect(catalog.groups.flatMap((group) => group.items)).toHaveLength(2);
    for (const value of [
      catalog,
      catalog.items,
      item,
      item.evidence,
      item.relationships,
      item.relationships[0],
      item.capabilities,
      catalog.groups,
      catalog.groups[0],
      catalog.groups[0]?.items,
      catalog.historySections,
      catalog.limitations,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it('orders deterministically without choosing a latest version or collapsing independent equal values', () => {
    const records = acquire([
      observation({ id: 'z' }),
      observation({ id: 'a' }),
      observation({ id: 'a', meta: { versionId: '2' } }),
    ]);
    const forward = buildClinicalCatalog(records, context);
    const reverse = buildClinicalCatalog([...records].reverse(), context);
    expect(forward.groups).toEqual(reverse.groups);
    expect(forward.items).toHaveLength(3);
    expect(buildClinicalCatalog([records[0]!, records[0]!], context).items).toHaveLength(1);
  });

  it('grants numerical capability only from exact same-context engine-selected references', () => {
    const records = acquire([observation(), observation({ id: 'cancelled', status: 'cancelled' })]);
    const series = analyzeQuantitySeries(records, {
      patientContext: context,
      measurement: {
        coding: { system: 'http://loinc.org', code: '29463-7' },
        unit: { system: 'http://unitsofmeasure.org', code: 'kg' },
      },
    });
    const catalog = buildClinicalCatalog(records, context, [series]);
    expect(catalog.historySections[0]?.items).toHaveLength(1);
    expect(catalog.historySections[0]?.items[0]?.record).toBe(series.points[0]?.record);
    expect(catalog.historySections[1]?.status).toBe('planned');
    expect(buildClinicalCatalog(records, context).historySections[0]?.status).toBe('unavailable');
    const detached = acquire([observation()]);
    expect(
      buildClinicalCatalog(detached, context, [series]).historySections[0]?.items,
    ).toHaveLength(0);
    const foreignSeries = { ...series, patientContext: { ...context, sourceNamespace: 'other' } };
    expect(
      buildClinicalCatalog(records, context, [foreignSeries]).historySections[0]?.items,
    ).toHaveLength(0);
    const versions = acquire([observation(), observation({ meta: { versionId: '2' } })]);
    const ambiguousSeries = analyzeQuantitySeries(versions, {
      patientContext: context,
      measurement: series.measurement,
    });
    expect(
      buildClinicalCatalog(versions, context, [ambiguousSeries]).historySections[0]?.items,
    ).toHaveLength(0);
  });

  it('keeps unsupported resource types at acquisition and rejects absent catalog context', () => {
    const store = createAcquisitionStore();
    expect(
      store.acquire({
        sourceNamespace: context.sourceNamespace,
        patientContext: context,
        resource: { resourceType: 'DiagnosticReport', id: 'fictional' },
      }),
    ).toMatchObject({ status: 'rejected', reason: 'unsupported-resource-type' });
    expect(() => buildClinicalCatalog([], { ...context, sourceNamespace: '' })).toThrow(RangeError);
    expect(buildClinicalCatalog([], context).groups).toEqual([]);
  });
});
