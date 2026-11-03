import { describe, expect, it } from 'vitest';
import { createAcquisitionStore, type PatientContext } from '@myfhir/fhir-acquisition';
import {
  conditionCategorySystem,
  conditionClinicalSystem,
  conditionVerificationSystem,
} from '@myfhir/fhir-core';
import { analyzeQuantitySeries } from '@myfhir/fhir-longitudinal';
import { buildClinicalCatalog } from '../src/index';

const context = { sourceNamespace: 'synthetic:conditions', patientId: 'fictional-patient' };
function category(code: string) {
  return { coding: [{ system: conditionCategorySystem, code }] };
}
function condition(fields: Record<string, unknown> = {}) {
  return {
    resourceType: 'Condition',
    id: 'fictional-condition',
    subject: { reference: 'Patient/fictional-patient' },
    category: [category('problem-list-item')],
    clinicalStatus: { coding: [{ system: conditionClinicalSystem, code: 'active' }] },
    verificationStatus: { coding: [{ system: conditionVerificationSystem, code: 'provisional' }] },
    ...fields,
  };
}
function acquire(resources: readonly unknown[], patientContext: PatientContext = context) {
  const store = createAcquisitionStore();
  resources.forEach((resource) => {
    const result = store.acquire({
      resource,
      patientContext,
      sourceNamespace: patientContext.sourceNamespace,
    });
    if (result.status !== 'acquired') throw new Error('Invalid fixture');
  });
  return store.records();
}

describe('Condition catalog organization', () => {
  it('separates exact categories, retains agreeing evidence and keeps each native record singular', () => {
    const records = acquire([
      condition({ category: [category('problem-list-item'), category('problem-list-item')] }),
      condition({
        id: 'fictional-encounter',
        category: [category('encounter-diagnosis')],
        encounter: { reference: 'Encounter/not-acquired' },
      }),
    ]);
    const catalog = buildClinicalCatalog(records, context);
    expect(catalog.groups.map((group) => [group.category, group.items.length])).toEqual([
      ['problem-list-item', 1],
      ['encounter-diagnosis', 1],
    ]);
    expect(
      catalog.items.find((item) => item.identity.logicalId === 'fictional-condition')?.evidence,
    ).toHaveLength(2);
    expect(catalog.items[0]?.conditionStatuses?.verification).toMatchObject({
      state: 'selected',
      code: 'provisional',
    });
    expect(buildClinicalCatalog([...records].reverse(), context).groups).toEqual(catalog.groups);
    expect(buildClinicalCatalog([records[0]!, records[0]!], context).items).toHaveLength(1);
  });

  it.each([
    { category: [] },
    { category: [{ text: 'problem-list-item' }] },
    { category: [{ coding: 'malformed' }] },
    { category: [category('problem-list-item'), category('encounter-diagnosis')] },
    { category: [{ coding: [{ system: 'urn:foreign', code: 'problem-list-item' }] }] },
    {
      category: [
        { coding: [{ system: conditionCategorySystem, code: 'problem-list-item', version: '1' }] },
      ],
    },
    { modifierExtension: [{ url: 'urn:fictional:modifier', valueBoolean: true }] },
  ])('keeps unknown/ambiguous metadata discoverable: %j', (fields) => {
    const records = acquire([condition(fields)]);
    const catalog = buildClinicalCatalog(records, context);
    expect(catalog.items[0]?.category).toBe('unclassified-condition');
    expect(catalog.groups[0]?.label).toBe('Other / unclassified Conditions');
    expect(catalog.groups[0]?.items[0]?.record).toBe(records[0]);
  });

  it('never infers category from diagnosis display or an Encounter assertion', () => {
    const original = condition({
      code: { text: 'Encounter diagnosis problem-list-item' },
      encounter: { reference: 'Encounter/fictional' },
    });
    Reflect.deleteProperty(original, 'category');
    const catalog = buildClinicalCatalog(acquire([original]), context);
    expect(catalog.items[0]).toMatchObject({
      category: 'unclassified-condition',
      reason: 'missing-category',
    });
  });

  it('isolates source/patient contexts, preserves revisions and never grants numerical capability', () => {
    const records = acquire([condition(), condition({ meta: { versionId: '2' } })]);
    const foreign = acquire([condition()], { ...context, sourceNamespace: 'synthetic:foreign' });
    const patient = { ...context, patientId: 'another-person' };
    const otherPatient = acquire(
      [condition({ subject: { reference: 'Patient/another-person' } })],
      patient,
    );
    const catalog = buildClinicalCatalog([...records, ...foreign, ...otherPatient], context);
    expect(catalog.items).toHaveLength(2);
    expect(catalog.exclusions).toHaveLength(2);
    expect(new Set(catalog.items.map((item) => item.key)).size).toBe(2);
    expect(
      buildClinicalCatalog(foreign, { ...context, sourceNamespace: 'synthetic:foreign' }).items[0]
        ?.key,
    ).not.toBe(catalog.items[0]?.key);
    const series = analyzeQuantitySeries(records, {
      patientContext: context,
      measurement: {
        coding: { system: 'http://loinc.org', code: '29463-7' },
        unit: { system: 'http://unitsofmeasure.org', code: 'kg' },
      },
    });
    expect(series.points).toEqual([]);
    expect(series.exclusions.every((entry) => entry.reason === 'not-observation')).toBe(true);
    expect(buildClinicalCatalog(records, context, [series]).historySections[0]?.status).toBe(
      'unavailable',
    );
  });

  it('preserves unresolved source references and status evidence without interpreting evidence/stage', () => {
    const original = condition({
      encounter: { reference: 'Encounter/fictional' },
      recorder: { reference: 'Practitioner/fictional-recorder' },
      asserter: { identifier: { value: 'unresolved' } },
      evidence: [
        {
          detail: [{ reference: 'Observation/fictional' }, { identifier: { value: 'unresolved' } }],
        },
      ],
      stage: [{ assessment: [{ reference: 'DiagnosticReport/fictional' }] }],
      unknownField: { preserved: true },
    });
    const before = JSON.stringify(original);
    const records = acquire([original]);
    const item = buildClinicalCatalog(records, context).items[0]!;
    expect(item.resource).toEqual(original);
    expect(item.resource).toBe(records[0]?.resource);
    expect(item.relationships.map((entry) => entry.path)).toEqual([
      'subject',
      'encounter',
      'recorder',
      'asserter',
      'evidence[0].detail[0]',
      'evidence[0].detail[1]',
      'stage[0].assessment[0]',
    ]);
    expect(item.relationships.every((entry) => entry.resolution === 'unresolved')).toBe(true);
    expect(item.relationships.find((entry) => entry.path === 'asserter')).toMatchObject({
      reason: 'unsupported-reference',
    });
    for (const value of [
      item,
      item.relationships,
      item.relationships[0],
      item.conditionStatuses,
      item.conditionStatuses?.clinical.evidence,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(JSON.stringify(original)).toBe(before);
  });
});
