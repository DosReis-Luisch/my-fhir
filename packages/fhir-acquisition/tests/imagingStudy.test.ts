import { describe, expect, it } from 'vitest';
import { imagingContext, imagingStudy } from '@myfhir/synthetic';
import { createAcquisitionStore } from '../src/index';

function request(resource: unknown) {
  return {
    sourceNamespace: imagingContext.sourceNamespace,
    patientContext: imagingContext,
    resource,
  };
}

describe('ImagingStudy acquisition', () => {
  it('retains native study/series/instance metadata and unknown fields without changing the input', () => {
    const original = { ...imagingStudy, unknownField: { preserved: true } };
    const before = JSON.stringify(original);
    const result = createAcquisitionStore().acquire(request(original));
    if (result.status !== 'acquired') throw new Error('Expected synthetic study');
    expect(result.record.resource).toEqual(original);
    expect(result.record.resource).not.toBe(original);
    expect(Object.isFrozen(result.record.resource)).toBe(true);
    expect(Object.isFrozen(original)).toBe(false);
    expect(JSON.stringify(original)).toBe(before);
    expect(result.record.metadata).toMatchObject({
      identity: {
        sourceNamespace: imagingContext.sourceNamespace,
        resourceType: 'ImagingStudy',
        logicalId: imagingStudy.id,
      },
      versionId: '1',
      patientContext: imagingContext,
      fhirValidation: 'not-performed',
      authorization: 'not-checked',
    });
  });

  it.each(['registered', 'available', 'cancelled', 'entered-in-error', 'unknown'] as const)(
    'accepts native status %s structurally without implying completed examination',
    (status) => {
      expect(createAcquisitionStore().acquire(request({ ...imagingStudy, status })).status).toBe(
        'acquired',
      );
    },
  );

  it.each([
    [{ status: 'final' }, 'invalid-imaging-study-shape'],
    [{ id: 'bad/id' }, 'invalid-resource-id'],
    [{ meta: { versionId: '' } }, 'invalid-version'],
    [{ started: 42 }, 'invalid-imaging-study-shape'],
    [{ description: {} }, 'invalid-imaging-study-shape'],
    [{ numberOfSeries: -1 }, 'invalid-imaging-study-shape'],
    [{ numberOfInstances: 1.5 }, 'invalid-imaging-study-shape'],
    [{ modality: 'DX' }, 'invalid-imaging-study-shape'],
    [{ modality: [{ code: 'DX' }] }, 'invalid-imaging-study-shape'],
    [
      { identifier: [{ system: 'urn:dicom:uid', value: 'missing-uid' }] },
      'invalid-imaging-study-shape',
    ],
    [{ series: {} }, 'invalid-imaging-study-shape'],
    [{ series: [{ modality: imagingStudy.series![0]!.modality }] }, 'invalid-imaging-study-shape'],
    [{ series: [{ ...imagingStudy.series![0], uid: '' }] }, 'invalid-imaging-study-shape'],
    [
      { series: [{ ...imagingStudy.series![0], uid: '2.25.123\n' }] },
      'invalid-imaging-study-shape',
    ],
    [
      { series: [{ ...imagingStudy.series![0], instance: [{ uid: '2.25.123' }] }] },
      'invalid-imaging-study-shape',
    ],
    [
      {
        series: [
          {
            ...imagingStudy.series![0],
            instance: [{ sopClass: imagingStudy.series![0]!.instance![0]!.sopClass }],
          },
        ],
      },
      'invalid-imaging-study-shape',
    ],
    [{ subject: {} }, 'missing-patient-reference'],
    [{ subject: { reference: 'Patient/another-person' } }, 'patient-context-mismatch'],
    [{ subject: { reference: 'Group/fictional-group' } }, 'unsupported-patient-reference'],
    [{ subject: { reference: 'Device/fictional-device' } }, 'unsupported-patient-reference'],
    [
      { subject: { reference: 'Patient/demo-alex-morgan', identifier: { value: 'ambiguous' } } },
      'ambiguous-patient-reference',
    ],
    [
      { subject: { reference: 'Patient/demo-alex-morgan', type: 'Group' } },
      'unsupported-patient-reference',
    ],
    [{ subject: [] }, 'ambiguous-patient-reference'],
    [{ unknown: undefined }, 'unsupported-json-input'],
  ] as const)('rejects unsupported or malformed input: %j', (fields, reason) => {
    const store = createAcquisitionStore();
    expect(store.acquire(request({ ...imagingStudy, ...fields }))).toMatchObject({
      status: 'rejected',
      reason,
    });
    expect(store.records()).toEqual([]);
  });

  it('holds missing subjects and never invents identifiers or counts from omitted metadata', () => {
    const missing = { ...imagingStudy };
    // Test a runtime shape outside the native mandatory subject contract.
    Reflect.deleteProperty(missing, 'subject');
    expect(createAcquisitionStore().acquire(request(missing))).toMatchObject({
      status: 'rejected',
      reason: 'missing-patient-reference',
    });
    const minimal = {
      resourceType: 'ImagingStudy',
      id: 'fictional-minimal-study',
      status: 'registered',
      subject: imagingStudy.subject,
    };
    const result = createAcquisitionStore().acquire(request(minimal));
    expect(result).toMatchObject({ status: 'acquired', record: { resource: minimal } });
    if (result.status === 'acquired')
      expect(Object.keys(result.record.resource).sort()).toEqual(Object.keys(minimal).sort());
  });

  it('keeps duplicate, conflict and version semantics intact', () => {
    const store = createAcquisitionStore();
    const first = store.acquire(request(imagingStudy));
    expect(store.acquire(request(imagingStudy))).toMatchObject({ status: 'duplicate' });
    expect(
      store.acquire(request({ ...imagingStudy, description: 'Conflicting fictional content' })),
    ).toMatchObject({ status: 'conflict', reason: 'identity-version-content-conflict' });
    expect(store.acquire(request({ ...imagingStudy, meta: { versionId: '2' } })).status).toBe(
      'acquired',
    );
    expect(store.records()).toHaveLength(2);
    if (first.status === 'acquired') expect(store.records()[0]).toBe(first.record);
  });
});
