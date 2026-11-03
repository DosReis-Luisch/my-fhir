import { describe, expect, it } from 'vitest';
import type { DiagnosticReport } from '@myfhir/fhir-core';
import { createAcquisitionStore } from '../src/index';

const patientContext = { sourceNamespace: 'synthetic:lab', patientId: 'fictional-patient' };
function report(fields: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    resourceType: 'DiagnosticReport',
    id: 'fictional-report',
    status: 'final',
    code: { text: 'Fictional report' },
    subject: { reference: 'Patient/fictional-patient' },
    ...fields,
  };
}
function request(resource: unknown) {
  return { sourceNamespace: patientContext.sourceNamespace, patientContext, resource };
}

describe('DiagnosticReport acquisition', () => {
  it('preserves native fields, unknown content and separate identity/version/context metadata', () => {
    const resource = {
      ...report({
        meta: { versionId: '1' },
        result: [{ reference: 'Observation/fictional-result' }],
      }),
      unknownField: { retain: ['unchanged'] },
      presentedForm: [{ contentType: 'application/pdf', url: 'urn:fictional:attachment' }],
    };
    const before = JSON.stringify(resource);
    const result = createAcquisitionStore().acquire(request(resource));
    expect(result.status).toBe('acquired');
    if (result.status !== 'acquired') throw new Error('Expected synthetic acquisition');
    expect(result.record.resource).toEqual(resource);
    expect(result.record.resource).not.toBe(resource);
    expect(Object.isFrozen(result.record.resource)).toBe(true);
    expect(Object.isFrozen(resource)).toBe(false);
    expect(JSON.stringify(resource)).toBe(before);
    expect(result.record.metadata).toMatchObject({
      identity: {
        sourceNamespace: patientContext.sourceNamespace,
        resourceType: 'DiagnosticReport',
        logicalId: 'fictional-report',
      },
      versionId: '1',
      patientContext,
      fhirValidation: 'not-performed',
      authorization: 'not-checked',
    });
  });

  it.each([
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
  ] as const)('accepts native status %s without claiming presentation eligibility', (status) => {
    expect(createAcquisitionStore().acquire(request(report({ status })))).toMatchObject({
      status: 'acquired',
    });
  });

  it.each([
    [{ subject: null }, 'ambiguous-patient-reference'],
    [{ subject: {} }, 'missing-patient-reference'],
    [{ subject: { reference: 'Patient/another-patient' } }, 'patient-context-mismatch'],
    [
      { subject: { reference: 'https://fictional.invalid/Patient/fictional-patient' } },
      'unsupported-patient-reference',
    ],
    [
      { subject: { reference: 'Patient/fictional-patient', identifier: { value: 'ambiguous' } } },
      'ambiguous-patient-reference',
    ],
    [
      { subject: { reference: 'Patient/fictional-patient', type: 'Group' } },
      'unsupported-patient-reference',
    ],
    [{ status: 'invented' }, 'invalid-diagnostic-report-shape'],
    [{ code: null }, 'invalid-diagnostic-report-shape'],
    [{ code: {} }, 'invalid-diagnostic-report-shape'],
    [{ code: { coding: 'malformed' } }, 'invalid-diagnostic-report-shape'],
    [{ code: { coding: [{ code: 17 }] } }, 'invalid-diagnostic-report-shape'],
    [{ id: 'invalid/id' }, 'invalid-resource-id'],
    [{ meta: { versionId: '' } }, 'invalid-version'],
  ] as const)('rejects malformed or mismatched input %j', (fields, reason) => {
    const store = createAcquisitionStore();
    expect(store.acquire(request({ ...report(), ...fields }))).toMatchObject({
      status: 'rejected',
      reason,
    });
    expect(store.records()).toEqual([]);
  });

  it('rejects an absent subject and non-JSON content using existing boundary rules', () => {
    const missingSubject = report();
    delete missingSubject.subject;
    const store = createAcquisitionStore();
    expect(store.acquire(request(missingSubject))).toMatchObject({
      status: 'rejected',
      reason: 'missing-patient-reference',
    });
    expect(store.acquire(request({ ...report(), unknown: undefined }))).toMatchObject({
      status: 'rejected',
      reason: 'unsupported-json-input',
    });
    expect(
      store.acquire(
        request({ ...report(), code: { coding: [{ system: 'urn:fictional', code: 'report' }] } }),
      ),
    ).toMatchObject({ status: 'acquired' });
  });

  it('keeps duplicate, conflict, revision, type and source semantics intact', () => {
    const store = createAcquisitionStore();
    const original = report({ meta: { versionId: '1' } });
    const first = store.acquire(request(original));
    expect(store.acquire(request(original))).toMatchObject({ status: 'duplicate' });
    expect(
      store.acquire(request({ ...original, code: { text: 'Different content' } })),
    ).toMatchObject({ status: 'conflict', reason: 'identity-version-content-conflict' });
    expect(store.acquire(request(report({ meta: { versionId: '2' } }))).status).toBe('acquired');
    const foreign = { ...patientContext, sourceNamespace: 'synthetic:other-lab' };
    expect(
      store.acquire({
        resource: original,
        sourceNamespace: foreign.sourceNamespace,
        patientContext: foreign,
      }).status,
    ).toBe('acquired');
    expect(
      store.acquire(
        request({
          resourceType: 'Observation',
          id: original.id,
          status: 'final',
          code: {},
          subject: original.subject,
        }),
      ).status,
    ).toBe('acquired');
    expect(store.records()).toHaveLength(4);
    if (first.status !== 'acquired') throw new Error('Expected acquisition');
    expect(store.records()[0]).toBe(first.record);
    expect(first.record.resource).toEqual(original);
  });
});
