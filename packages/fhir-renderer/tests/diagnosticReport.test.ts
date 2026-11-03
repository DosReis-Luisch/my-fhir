import { describe, expect, it } from 'vitest';
import type { DiagnosticReport } from '@myfhir/fhir-core';
import { presentResource, presentResourceWithProfiles } from '../src/index';

function report(fields: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    resourceType: 'DiagnosticReport',
    id: 'fictional-report',
    status: 'final',
    code: { text: 'Fictional laboratory report' },
    subject: { reference: 'Patient/fictional-patient' },
    effectiveDateTime: '2026-10-15T09:00:00+01:00',
    issued: '2026-10-15T12:15:00+01:00',
    result: [{ reference: 'Observation/fictional-result' }],
    ...fields,
  };
}

describe('conservative DiagnosticReport presentation', () => {
  it('shows only supplied final-report metadata and preserves source identity', () => {
    const original = report();
    const before = JSON.stringify(original);
    const presentation = presentResource(original);
    expect(presentation.kind).toBe('diagnostic-report');
    expect(presentation.title).toBe(original.code.text);
    expect(presentation.fields).toEqual([
      { label: 'Report status', value: 'final', sourcePath: 'status' },
      {
        label: 'Clinically effective time (as supplied)',
        value: original.effectiveDateTime,
        sourcePath: 'effectiveDateTime',
      },
      { label: 'Issued time (as supplied)', value: original.issued, sourcePath: 'issued' },
    ]);
    expect(presentation.source).toBe(original);
    expect(JSON.stringify(original)).toBe(before);
    expect(presentation.fields.some((field) => field.sourcePath === 'result')).toBe(false);
    expect(presentResourceWithProfiles(original, []).fieldHints).toEqual([]);
  });

  it('preserves supplied partial date precision and never substitutes issued time', () => {
    const partial = presentResource(report({ effectiveDateTime: '2026-10' }));
    expect(partial.fields.find((field) => field.sourcePath === 'effectiveDateTime')?.value).toBe(
      '2026-10',
    );
    const withoutClinicalTime = report();
    delete withoutClinicalTime.effectiveDateTime;
    const presentation = presentResource(withoutClinicalTime);
    expect(presentation.fields.some((field) => field.sourcePath === 'effectiveDateTime')).toBe(
      false,
    );
    expect(presentation.fields.find((field) => field.sourcePath === 'issued')?.value).toBe(
      withoutClinicalTime.issued,
    );
  });

  it.each([
    'registered',
    'partial',
    'preliminary',
    'amended',
    'corrected',
    'appended',
    'cancelled',
    'entered-in-error',
    'unknown',
  ] as const)('falls back rather than presenting status %s as a final report', (status) => {
    const resource = report({ status });
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.notices.join(' ')).toContain(status);
    expect(presentation.source).toBe(resource);
  });

  it.each([
    { conclusion: 'Fictional conclusion, not interpreted' },
    { conclusionCode: [{ text: 'Fictional conclusion code' }] },
    {
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml">Fictional narrative</div>',
      },
    },
    { presentedForm: [{ contentType: 'application/pdf', url: 'urn:fictional:pdf' }] },
    { media: [{ link: { reference: 'Media/fictional-image' } }] },
    { imagingStudy: [{ reference: 'ImagingStudy/fictional' }] },
    { effectivePeriod: { start: '2026-10-15', end: '2026-10-16' } },
    { modifierExtension: [{ url: 'urn:fictional:modifier', valueBoolean: true }] },
  ] as const)('falls back for unsupported content without interpreting it: %j', (fields) => {
    // Deliberately inspect unsupported shapes using the same trusted-resource API boundary as existing tests.
    const resource = { ...report(), ...fields } as unknown as DiagnosticReport;
    const before = JSON.stringify(resource);
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.source).toBe(resource);
    expect(JSON.stringify(resource)).toBe(before);
  });

  it('falls back safely for malformed selected metadata', () => {
    for (const fields of [
      { code: { coding: 'malformed' } },
      { code: {} },
      { issued: 42 },
      { effectiveDateTime: { invalid: true } },
      { result: 'malformed' },
      { result: [null] },
    ]) {
      const resource = { ...report(), ...fields } as unknown as DiagnosticReport;
      expect(presentResource(resource).kind).toBe('generic');
    }
  });
});
