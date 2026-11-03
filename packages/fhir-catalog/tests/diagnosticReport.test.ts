import { describe, expect, it } from 'vitest';
import { createAcquisitionStore, type AcquiredResource, type PatientContext } from '@myfhir/fhir-acquisition';
import { buildClinicalCatalog, diagnosticReportCategorySystem, observationCategorySystem } from '../src/index';

const context = { sourceNamespace: 'synthetic:lab', patientId: 'fictional-patient' };
function report(fields: Record<string, unknown> = {}) {
  return {
    resourceType: 'DiagnosticReport', id: 'fictional-report', status: 'final',
    subject: { reference: `Patient/${context.patientId}` }, code: { text: 'Fictional report' },
    category: [{ coding: [{ system: diagnosticReportCategorySystem, code: 'LAB' }] }],
    result: [{ reference: 'Observation/result-a' }, { reference: 'Observation/result-b' }],
    ...fields,
  };
}
function observation(id = 'result-a', fields: Record<string, unknown> = {}) {
  return {
    resourceType: 'Observation', id, status: 'final', code: { text: 'Fictional result' },
    category: [{ coding: [{ system: observationCategorySystem, code: 'laboratory' }] }],
    subject: { reference: `Patient/${context.patientId}` }, ...fields,
  };
}
function acquire(resources: readonly unknown[], patientContext: PatientContext = context) {
  const store = createAcquisitionStore();
  for (const resource of resources) {
    const result = store.acquire({ resource, patientContext, sourceNamespace: patientContext.sourceNamespace });
    if (result.status !== 'acquired') throw new Error('Invalid synthetic fixture');
  }
  return store.records();
}
function catalogReport(records: readonly AcquiredResource[]) {
  return buildClinicalCatalog(records, context).items.find((item) => item.resourceType === 'DiagnosticReport')!;
}

describe('laboratory report catalog', () => {
  it('separates LAB reports from laboratory results and does not inherit report classification', () => {
    const records = acquire([report(), observation(), observation('result-b', { category: [] })]);
    const catalog = buildClinicalCatalog(records, context);
    expect(catalog.groups.map((group) => [group.category, group.items.length])).toEqual([
      ['laboratory-report', 1], ['laboratory', 1], ['unclassified', 1],
    ]);
    expect(catalogReport(records).evidence).toEqual([{
      path: 'category[0].coding[0]', system: diagnosticReportCategorySystem, code: 'LAB', version: undefined,
    }]);
    expect(catalog.items.every((item) => !item.capabilities.includes('numerical-history'))).toBe(true);
  });

  it.each([
    [{ category: [] }, 'missing-category'],
    [{ category: [{ text: 'blood analysis laboratory' }] }, 'unsupported-category'],
    [{ category: [{ coding: [{ system: observationCategorySystem, code: 'laboratory' }] }] }, 'unsupported-category'],
    [{ category: [{ coding: [{ system: diagnosticReportCategorySystem, code: 'LAB', version: '1' }] }] }, 'unsupported-category'],
    [{ category: [{ coding: [{ system: diagnosticReportCategorySystem, code: 'RAD' }] }] }, 'unsupported-category'],
    [{ category: [{ coding: [{ system: diagnosticReportCategorySystem, code: 'LAB' }, { system: diagnosticReportCategorySystem, code: 'RAD' }] }] }, 'ambiguous-category'],
    [{ category: { coding: 'malformed' } }, 'unsupported-category'],
    [{ modifierExtension: [{ url: 'urn:fictional:modifier', valueBoolean: true }] }, 'modifier-extension'],
  ] as const)('keeps unsupported reports visible as unclassified: %j', (fields, reason) => {
    const catalog = buildClinicalCatalog(acquire([report(fields)]), context);
    expect(catalog.items[0]).toMatchObject({ category: 'unclassified', reason });
    expect(catalog.groups[0]?.items).toHaveLength(1);
    expect(catalog.groups[0]?.category).toBe('unclassified');
  });

  it('retains agreeing duplicate categories as evidence without duplicating a report', () => {
    const raw = report();
    const records = acquire([{ ...raw, category: [...raw.category, ...raw.category] }]);
    expect(catalogReport(records)).toMatchObject({ category: 'laboratory-report', reason: 'explicit-category' });
    expect(catalogReport(records).evidence).toHaveLength(2);
  });

  it('does not classify missing categories from code text or retain an Observation-system report category', () => {
    const missingCategory = report({ code: { text: 'Blood analysis laboratory' } });
    const { category, ...withoutCategory } = missingCategory;
    expect(category).toHaveLength(1);
    expect(catalogReport(acquire([withoutCategory]))).toMatchObject({
      category: 'unclassified', reason: 'missing-category',
    });
    const observationWithReportCategory = observation('result-a', {
      category: [{ coding: [{ system: diagnosticReportCategorySystem, code: 'LAB' }] }],
    });
    const catalog = buildClinicalCatalog(acquire([observationWithReportCategory]), context);
    expect(catalog.items[0]).toMatchObject({ category: 'unclassified', reason: 'unsupported-category' });
  });

  it('resolves multiple direct local results, preserves order and duplicate assertions without extra records', () => {
    const raw = report({ result: [
      { reference: 'Observation/result-b' }, { reference: 'Observation/result-a' }, { reference: 'Observation/result-a' },
    ] });
    const records = acquire([raw, observation(), observation('result-b')]);
    const forward = buildClinicalCatalog(records, context);
    const reverse = buildClinicalCatalog([...records].reverse(), context);
    expect(forward).toEqual(reverse);
    expect(forward.items).toHaveLength(3);
    const item = catalogReport(records);
    expect(item.relationships.map((relationship) => relationship.resolution)).toEqual(['resolved', 'resolved', 'resolved']);
    for (const relationship of item.relationships) {
      expect(Object.isFrozen(relationship)).toBe(true);
      if (relationship.resolution !== 'resolved') throw new Error('Expected local resolution');
      expect(records).toContain(relationship.target);
      expect(relationship.target.metadata.identity.sourceNamespace).toBe(context.sourceNamespace);
      expect(relationship.target.metadata.patientContext).toEqual(context);
    }
    expect(item.resource).toEqual(raw);
    expect(Object.isFrozen(item.relationships)).toBe(true);
    expect(Object.isFrozen(item.resource)).toBe(true);
  });

  it('reports missing, foreign-source and foreign-patient targets without cross-context resolution', () => {
    const reportOnly = acquire([report({ result: [{ reference: 'Observation/result-a' }] })]);
    expect(catalogReport(reportOnly).relationships[0]).toMatchObject({ resolution: 'unresolved', reason: 'missing-target' });
    const foreign = acquire([observation()], { ...context, sourceNamespace: 'synthetic:other-lab' });
    expect(catalogReport([...reportOnly, ...foreign]).relationships[0]).toMatchObject({ reason: 'source-mismatch' });
    const wrongPatient = acquire([observation('result-a', { subject: { reference: 'Patient/another-person' } })], { ...context, patientId: 'another-person' });
    expect(catalogReport([...reportOnly, ...wrongPatient]).relationships[0]).toMatchObject({ reason: 'patient-mismatch' });
    const local = acquire([observation()]);
    const link = catalogReport([...reportOnly, ...foreign, ...local]).relationships[0]!;
    expect(link.resolution).toBe('resolved');
    if (link.resolution === 'resolved') expect(link.target).toBe(local[0]);
    expect(buildClinicalCatalog([...reportOnly, ...foreign, ...wrongPatient], context).exclusions).toHaveLength(2);
  });

  it('does not select a version, hide out-of-context revisions, or guess between duplicate snapshots', () => {
    const reports = acquire([report({ result: [{ reference: 'Observation/result-a' }] })]);
    const targets = acquire([observation(), observation('result-a', { meta: { versionId: '2' } })]);
    expect(catalogReport([...reports, ...targets]).relationships[0]).toMatchObject({ reason: 'multiple-retained-versions' });
    const otherPatientRevision = acquire([
      observation('result-a', { subject: { reference: 'Patient/another-person' }, meta: { versionId: '3' } }),
    ], { ...context, patientId: 'another-person' });
    expect(catalogReport([...reports, targets[0]!, ...otherPatientRevision]).relationships[0]).toMatchObject({ reason: 'multiple-retained-versions' });
    const one = acquire([observation()]);
    const duplicate = acquire([observation()]);
    expect(catalogReport([...reports, ...one, ...duplicate]).relationships[0]).toMatchObject({ reason: 'ambiguous-target' });
    expect(catalogReport([...reports, ...one, ...one]).relationships[0]?.resolution).toBe('resolved');
  });

  it.each([
    { reference: 'https://fictional.invalid/Observation/result-a' },
    { reference: '#result-a' },
    { reference: 'Observation/result-a/_history/1' },
    { reference: 'Observation/result-a\n' },
    { reference: 'DiagnosticReport/result-a' },
    { identifier: { value: 'result-a' } },
    { reference: 'Observation/result-a', identifier: { value: 'ambiguous' } },
    { reference: 'Observation/result-a', type: 'Patient' },
    { reference: 42 },
    null,
  ])('keeps unsupported result assertion explicit: %j', (assertion) => {
    const records = acquire([report({ result: [assertion] }), observation()]);
    expect(catalogReport(records).relationships[0]).toMatchObject({ resolution: 'unresolved', reason: 'unsupported-reference' });
    expect(catalogReport(records).resource).toEqual(report({ result: [assertion] }));
  });

  it('holds malformed result collections and modifier-bearing reports without traversing', () => {
    expect(catalogReport(acquire([report({ result: { reference: 'Observation/result-a' } }), observation()])).relationships[0])
      .toMatchObject({ reason: 'unsupported-reference' });
    expect(catalogReport(acquire([report({ modifierExtension: [{ url: 'urn:fictional:modifier' }] }), observation()])).relationships[0])
      .toMatchObject({ reason: 'unsafe-report' });
    const records = acquire([report(), observation('result-a', { hasMember: [{ reference: 'Observation/result-b' }] }), observation('result-b')]);
    const assertion = buildClinicalCatalog(records, context).items.find((item) => item.identity.logicalId === 'result-a')!.relationships.find((relationship) => relationship.path === 'hasMember[0]');
    expect(assertion).toMatchObject({ kind: 'assertion', resolution: 'unresolved', reason: 'resolution-not-implemented' });
  });
});
