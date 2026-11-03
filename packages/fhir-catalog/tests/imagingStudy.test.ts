import { describe, expect, it } from 'vitest';
import {
  createAcquisitionStore,
  type AcquiredResource,
  type PatientContext,
} from '@myfhir/fhir-acquisition';
import {
  imagingContext,
  imagingStudy,
  radiologyReport,
  laboratoryReport,
  laboratoryObservations,
} from '@myfhir/synthetic';
import { buildClinicalCatalog } from '../src/index';
import { analyzeQuantitySeries } from '@myfhir/fhir-longitudinal';

function acquire(resources: readonly unknown[], patientContext: PatientContext = imagingContext) {
  const store = createAcquisitionStore();
  for (const resource of resources) {
    const result = store.acquire({
      resource,
      sourceNamespace: patientContext.sourceNamespace,
      patientContext,
    });
    if (result.status !== 'acquired') throw new Error('Invalid synthetic fixture');
  }
  return store.records();
}
function reportItem(records: readonly AcquiredResource[]) {
  return buildClinicalCatalog(records, imagingContext).items.find(
    (item) => item.identity.logicalId === radiologyReport.id,
  )!;
}

describe('imaging classification and local relationships', () => {
  it('classifies native studies with resource-type evidence and keeps RAD and LAB distinct', () => {
    const catalog = buildClinicalCatalog(
      acquire([imagingStudy, radiologyReport, laboratoryReport, ...laboratoryObservations]),
      imagingContext,
    );
    expect(catalog.groups.map((group) => [group.category, group.items.length])).toEqual([
      ['laboratory-report', 1],
      ['laboratory', 2],
      ['radiology-report', 1],
      ['imaging-study', 1],
    ]);
    const study = catalog.items.find((item) => item.resourceType === 'ImagingStudy')!;
    expect(study.reason).toBe('resource-type');
    expect(study.evidence).toEqual([
      { kind: 'resource-type', path: 'resourceType', resourceType: 'ImagingStudy' },
    ]);
    expect(Object.isFrozen(study.evidence[0])).toBe(true);
    expect(study.capabilities).not.toContain('numerical-history');
    expect(
      catalog.items.find((item) => item.identity.logicalId === laboratoryReport.id)?.category,
    ).toBe('laboratory-report');
  });

  it.each([
    { category: [] },
    { category: [{ text: 'Radiology chest X-ray' }] },
    { category: [{ coding: [{ system: 'urn:wrong', code: 'RAD' }] }] },
    {
      category: [
        { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'rad' }] },
      ],
    },
    {
      category: [
        { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'CT' }] },
      ],
    },
    {
      category: [
        {
          coding: [
            { system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'RAD', version: '1' },
          ],
        },
      ],
    },
    {
      category: [
        {
          coding: [
            { system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'RAD' },
            { system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB' },
          ],
        },
      ],
    },
    { category: { coding: 'malformed' } },
    { modifierExtension: [{ url: 'urn:fictional:modifier', valueBoolean: true }] },
  ])('retains unsupported report categories in the unclassified group: %j', (fields) => {
    const records = acquire([{ ...radiologyReport, ...fields }, imagingStudy]);
    const catalog = buildClinicalCatalog(records, imagingContext);
    expect(reportItem(records).category).toBe('unclassified');
    expect(catalog.groups.find((group) => group.category === 'unclassified')?.items).toHaveLength(
      1,
    );
  });

  it('retains modifier-bearing studies as discoverable unclassified resources', () => {
    const modified = { ...imagingStudy, modifierExtension: [{ url: 'urn:fictional:modifier' }] };
    const catalog = buildClinicalCatalog(acquire([modified]), imagingContext);
    expect(catalog.items[0]).toMatchObject({
      category: 'unclassified',
      reason: 'modifier-extension',
    });
    expect(catalog.groups[0]?.items).toHaveLength(1);
  });

  it('resolves both result and study assertions in supplied order without duplicate records', () => {
    const report = {
      ...radiologyReport,
      result: laboratoryReport.result,
      imagingStudy: [
        { reference: `ImagingStudy/${imagingStudy.id}` },
        { reference: 'ImagingStudy/fictional-second-study' },
        { reference: `ImagingStudy/${imagingStudy.id}` },
      ],
    };
    const secondStudy = {
      resourceType: 'ImagingStudy',
      id: 'fictional-second-study',
      status: 'registered',
      subject: imagingStudy.subject,
    };
    const records = acquire([report, imagingStudy, secondStudy, ...laboratoryObservations]);
    const forward = buildClinicalCatalog(records, imagingContext);
    const reverse = buildClinicalCatalog([...records].reverse(), imagingContext);
    expect(forward).toEqual(reverse);
    expect(forward.items).toHaveLength(5);
    const links = reportItem(records).relationships;
    expect(links.map((link) => [link.kind, link.path, link.resolution])).toEqual([
      ['report-result', 'result[0]', 'resolved'],
      ['report-result', 'result[1]', 'resolved'],
      ['report-imaging-study', 'imagingStudy[0]', 'resolved'],
      ['report-imaging-study', 'imagingStudy[1]', 'resolved'],
      ['report-imaging-study', 'imagingStudy[2]', 'resolved'],
    ]);
    for (const link of links) {
      expect(Object.isFrozen(link)).toBe(true);
      if (link.resolution !== 'resolved') throw new Error('Expected local target');
      expect(records).toContain(link.target);
      expect(link.target.metadata.patientContext).toEqual(imagingContext);
    }
    expect(Object.isFrozen(links)).toBe(true);
  });

  it('distinguishes missing and foreign targets and resolves only the exact local source/patient', () => {
    const reports = acquire([radiologyReport]);
    expect(reportItem(reports).relationships[0]).toMatchObject({ reason: 'missing-target' });
    const foreign = acquire([imagingStudy], {
      ...imagingContext,
      sourceNamespace: 'synthetic:foreign-imaging',
    });
    expect(reportItem([...reports, ...foreign]).relationships[0]).toMatchObject({
      reason: 'source-mismatch',
    });
    const wrongPatient = acquire(
      [{ ...imagingStudy, subject: { reference: 'Patient/another-person' } }],
      { ...imagingContext, patientId: 'another-person' },
    );
    expect(reportItem([...reports, ...wrongPatient]).relationships[0]).toMatchObject({
      reason: 'patient-mismatch',
    });
    const local = acquire([imagingStudy]);
    const link = reportItem([...reports, ...foreign, ...local]).relationships[0]!;
    expect(link.resolution).toBe('resolved');
    if (link.resolution === 'resolved') expect(link.target).toBe(local[0]);
    expect(
      buildClinicalCatalog([...reports, ...foreign, ...wrongPatient], imagingContext).exclusions,
    ).toHaveLength(2);
  });

  it('holds multiple versions and distinct duplicate snapshots without choosing latest', () => {
    const reports = acquire([radiologyReport]);
    const local = acquire([imagingStudy]);
    const revision = acquire([{ ...imagingStudy, meta: { versionId: '2' } }]);
    expect(reportItem([...reports, ...local, ...revision]).relationships[0]).toMatchObject({
      reason: 'multiple-retained-versions',
    });
    const otherPatientRevision = acquire(
      [
        {
          ...imagingStudy,
          meta: { versionId: '3' },
          subject: { reference: 'Patient/another-person' },
        },
      ],
      { ...imagingContext, patientId: 'another-person' },
    );
    expect(
      reportItem([...reports, ...local, ...otherPatientRevision]).relationships[0],
    ).toMatchObject({ reason: 'multiple-retained-versions' });
    const duplicate = acquire([imagingStudy]);
    expect(reportItem([...reports, ...local, ...duplicate]).relationships[0]).toMatchObject({
      reason: 'ambiguous-target',
    });
    expect(reportItem([...reports, ...local, ...local]).relationships[0]?.resolution).toBe(
      'resolved',
    );
  });

  it.each([
    { reference: 'https://fictional.invalid/ImagingStudy/fictional-chest-study' },
    { reference: '#fictional-chest-study' },
    { reference: 'ImagingStudy/fictional-chest-study/_history/1' },
    { reference: 'ImagingStudy/fictional-chest-study\n' },
    { identifier: { value: 'fictional-chest-study' } },
    { reference: 'ImagingStudy/fictional-chest-study', identifier: { value: 'ambiguous' } },
    { reference: 'ImagingStudy/fictional-chest-study', type: 'Observation' },
    { reference: 'Observation/fictional-chest-study' },
    null,
  ])('retains unsupported assertions: %j', (assertion) => {
    const original = { ...radiologyReport, imagingStudy: [assertion] };
    const records = acquire([original, imagingStudy]);
    const report = reportItem(records);
    expect(report.relationships[0]).toMatchObject({
      resolution: 'unresolved',
      reason: 'unsupported-reference',
    });
    expect(report.resource).toEqual(original);
  });

  it('preserves malformed collections and holds unsafe report links', () => {
    expect(
      reportItem(acquire([{ ...radiologyReport, imagingStudy: {} }, imagingStudy]))
        .relationships[0],
    ).toMatchObject({ reason: 'unsupported-reference' });
    expect(
      reportItem(
        acquire([
          { ...radiologyReport, modifierExtension: [{ url: 'urn:fictional:modifier' }] },
          imagingStudy,
        ]),
      ).relationships[0],
    ).toMatchObject({ reason: 'unsafe-report' });
  });

  it('leaves studies and reports out of numerical analysis and history capabilities', () => {
    const records = acquire([imagingStudy, radiologyReport]);
    const series = analyzeQuantitySeries(records, {
      patientContext: imagingContext,
      measurement: {
        coding: { system: 'http://loinc.org', code: '29463-7' },
        unit: { system: 'http://unitsofmeasure.org', code: 'kg' },
      },
    });
    expect(series.points).toEqual([]);
    expect(series.exclusions.map((entry) => entry.reason)).toEqual([
      'not-observation',
      'not-observation',
    ]);
    expect(buildClinicalCatalog(records, imagingContext, [series]).historySections[0]?.status).toBe(
      'unavailable',
    );
  });
});
