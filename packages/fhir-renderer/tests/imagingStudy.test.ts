import { describe, expect, it } from 'vitest';
import type { DiagnosticReport, ImagingStudy } from '@myfhir/fhir-core';
import { imagingStudy, radiologyReport, laboratoryReport } from '@myfhir/synthetic';
import { presentResource } from '../src/index';

describe('metadata-only imaging presentation', () => {
  it('preserves the original and shows separate reported and listed metadata counts', () => {
    const original = { ...imagingStudy, numberOfSeries: 8, numberOfInstances: 20 };
    const before = JSON.stringify(original);
    const presentation = presentResource(original);
    expect(presentation.kind).toBe('imaging-study');
    expect(presentation.source).toBe(original);
    expect(presentation.title).toBe(original.description);
    const field = (path: string) => presentation.fields.find((entry) => entry.sourcePath === path);
    expect(field('numberOfSeries')).toMatchObject({
      label: 'Reported number of series',
      value: '8',
    });
    expect(field('numberOfInstances')?.value).toBe('20');
    expect(field('series')).toMatchObject({
      label: 'Listed series metadata entries (may be partial)',
      value: '1',
    });
    expect(field('series[0].instance')?.value).toBe('1');
    expect(field('series[0].uid')?.value).toBe(imagingStudy.series?.[0]?.uid);
    expect(field('series[0].instance[0].uid')?.value).toBe(
      imagingStudy.series?.[0]?.instance?.[0]?.uid,
    );
    expect(presentation.notices.join(' ')).toContain('No image retrieval or viewing');
    expect(JSON.stringify(original)).toBe(before);
  });

  it('does not infer friendly names for unknown supplied modality codes', () => {
    const resource = {
      ...imagingStudy,
      modality: [
        { system: 'http://dicom.nema.org/resources/ontology/DCM', code: 'FICTIONAL-UNKNOWN' },
      ],
    };
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('imaging-study');
    expect(presentation.fields.find((field) => field.sourcePath === 'modality[0]')?.value).toBe(
      'http://dicom.nema.org/resources/ontology/DCM | FICTIONAL-UNKNOWN',
    );
  });

  it('does not manufacture counts or dates for omitted metadata, retaining zero and partial supplied dates', () => {
    const minimal: ImagingStudy = {
      resourceType: 'ImagingStudy',
      status: 'registered',
      subject: imagingStudy.subject,
      started: '2026-10',
      numberOfSeries: 0,
    };
    const presentation = presentResource(minimal);
    expect(presentation.kind).toBe('imaging-study');
    expect(presentation.fields.find((field) => field.sourcePath === 'started')?.value).toBe(
      '2026-10',
    );
    expect(presentation.fields.find((field) => field.sourcePath === 'numberOfSeries')?.value).toBe(
      '0',
    );
    expect(
      presentation.fields.some(
        (field) => field.sourcePath === 'numberOfInstances' || field.sourcePath === 'series',
      ),
    ).toBe(false);
  });

  it.each([
    { status: 'cancelled' },
    { status: 'entered-in-error' },
    { status: 'unknown' },
    { numberOfSeries: -1 },
    { numberOfInstances: 1.5 },
    { started: {} },
    { series: [{ ...imagingStudy.series![0], uid: '' }] },
    { series: [{ ...imagingStudy.series![0], instance: [{ uid: '2.25.123' }] }] },
    { modality: [{ system: 'urn:unsupported', code: 'DX' }] },
    {
      modality: [
        { system: 'http://dicom.nema.org/resources/ontology/DCM', code: 'DX', version: 'future' },
      ],
    },
    { modifierExtension: [{ url: 'urn:fictional:modifier', valueBoolean: true }] },
    { note: [{ text: 'Fictional finding, not interpreted' }] },
    {
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml">Fictional narrative</div>',
      },
    },
    { endpoint: [{ reference: 'Endpoint/fictional' }] },
  ])('falls back for unsupported status or metadata without interpreting it: %j', (fields) => {
    const resource = { ...imagingStudy, ...fields } as unknown as ImagingStudy;
    const before = JSON.stringify(resource);
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.source).toBe(resource);
    expect(JSON.stringify(resource)).toBe(before);
  });

  it('supports RAD metadata without confusing study start, clinical report time and issued time', () => {
    const study = presentResource(imagingStudy);
    const report = presentResource(radiologyReport);
    expect(report.kind).toBe('diagnostic-report');
    expect(study.fields.find((field) => field.sourcePath === 'started')?.value).toBe(
      imagingStudy.started,
    );
    expect(report.fields.find((field) => field.sourcePath === 'effectiveDateTime')?.value).toBe(
      radiologyReport.effectiveDateTime,
    );
    expect(report.fields.find((field) => field.sourcePath === 'issued')?.value).toBe(
      radiologyReport.issued,
    );
    expect(study.fields.some((field) => field.sourcePath === 'issued')).toBe(false);
    expect(report.fields.some((field) => field.sourcePath === 'started')).toBe(false);
    expect(presentResource(laboratoryReport).kind).toBe('diagnostic-report');
    expect(report.source).toBe(radiologyReport);
  });

  it.each([
    { status: 'preliminary' },
    { status: 'cancelled' },
    { status: 'entered-in-error' },
    { conclusion: 'Fictional finding, not interpreted' },
    { presentedForm: [{ contentType: 'application/pdf', url: 'urn:fictional:pdf' }] },
    { media: [{ link: { reference: 'Media/fictional' } }] },
    { imagingStudy: {} },
    { imagingStudy: [null] },
  ])('preserves the report final-status/unsupported-content policy: %j', (fields) => {
    const resource = { ...radiologyReport, ...fields } as unknown as DiagnosticReport;
    expect(presentResource(resource)).toMatchObject({
      kind: 'generic',
      fields: [],
      source: resource,
    });
  });
});
