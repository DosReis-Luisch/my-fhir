import { describe, expect, it } from 'vitest';
import { createAcquisitionStore } from '../src/index';

const context = { sourceNamespace: 'synthetic:conditions', patientId: 'fictional-patient' };
function condition(fields: Record<string, unknown> = {}) {
  return {
    resourceType: 'Condition',
    id: 'fictional-condition',
    subject: { reference: 'Patient/fictional-patient' },
    ...fields,
  };
}
function request(resource: unknown) {
  return { sourceNamespace: context.sourceNamespace, patientContext: context, resource };
}

describe('native Condition acquisition', () => {
  it('accepts an optional-code Condition with unknown/unsupported fields preserved immutably', () => {
    const original = condition({
      unknownField: { retained: ['fictional'] },
      onsetAge: { value: 12, unit: 'years' },
    });
    const before = JSON.stringify(original);
    const result = createAcquisitionStore().acquire(request(original));
    if (result.status !== 'acquired') throw new Error('Expected synthetic Condition');
    expect(result.record.resource).toEqual(original);
    expect(result.record.resource).not.toHaveProperty('code');
    expect(result.record.resource).not.toHaveProperty('clinicalStatus');
    expect(result.record.metadata).toMatchObject({
      identity: {
        sourceNamespace: context.sourceNamespace,
        resourceType: 'Condition',
        logicalId: 'fictional-condition',
      },
      patientContext: context,
      fhirValidation: 'not-performed',
      authorization: 'not-checked',
    });
    expect(Object.isFrozen(result.record.resource)).toBe(true);
    if (result.record.resource.resourceType === 'Condition') {
      expect(Object.isFrozen(result.record.resource.subject)).toBe(true);
    }
    expect(Object.isFrozen(original)).toBe(false);
    expect(JSON.stringify(original)).toBe(before);
  });

  it.each([
    [{ id: '' }, 'invalid-resource-id'],
    [{ id: 'bad/id' }, 'invalid-resource-id'],
    [{ meta: { versionId: '' } }, 'invalid-version'],
    [{ subject: {} }, 'missing-patient-reference'],
    [{ subject: { reference: 'Patient/another-person' } }, 'patient-context-mismatch'],
    [{ subject: { reference: 'Group/fictional' } }, 'unsupported-patient-reference'],
    [
      { subject: { reference: 'Patient/fictional-patient', type: 'Group' } },
      'unsupported-patient-reference',
    ],
    [
      { subject: { reference: 'Patient/fictional-patient', identifier: { value: 'ambiguous' } } },
      'ambiguous-patient-reference',
    ],
    [{ subject: [] }, 'ambiguous-patient-reference'],
    [{ code: null }, 'invalid-condition-shape'],
    [{ clinicalStatus: { coding: 'active' } }, 'invalid-condition-shape'],
    [{ verificationStatus: { coding: [{ code: 42 }] } }, 'invalid-condition-shape'],
    [{ onsetDateTime: 42 }, 'invalid-condition-shape'],
    [{ abatementPeriod: 'malformed' }, 'invalid-condition-shape'],
    [{ evidence: 'malformed' }, 'invalid-condition-shape'],
    [{ unknown: undefined }, 'unsupported-json-input'],
  ] as const)(
    'rejects malformed selected structures or patient association: %j',
    (fields, reason) => {
      expect(createAcquisitionStore().acquire(request(condition(fields)))).toMatchObject({
        status: 'rejected',
        reason,
      });
    },
  );

  it('rejects missing/invalid context without extending the supported resource set', () => {
    const missing = condition();
    Reflect.deleteProperty(missing, 'subject');
    const store = createAcquisitionStore();
    expect(store.acquire(request(missing))).toMatchObject({
      status: 'rejected',
      reason: 'missing-patient-reference',
    });
    expect(
      store.acquire({
        ...request(condition()),
        patientContext: { ...context, sourceNamespace: 'foreign' },
      }),
    ).toMatchObject({ status: 'rejected', reason: 'source-context-mismatch' });
    expect(
      store.acquire({ ...request(condition()), patientContext: { ...context, patientId: '' } }),
    ).toMatchObject({ status: 'rejected', reason: 'invalid-context' });
    expect(store.acquire(request({ resourceType: 'Encounter', id: 'fictional' }))).toMatchObject({
      status: 'rejected',
      reason: 'unsupported-resource-type',
    });
  });

  it('preserves duplicate/conflict/version/source rules, including inconsistent status assertions', () => {
    const store = createAcquisitionStore();
    const resource = condition({
      meta: { versionId: '1' },
      clinicalStatus: {},
      abatementDateTime: '2026',
    });
    const first = store.acquire(request(resource));
    expect(first.status).toBe('acquired');
    expect(store.acquire(request(resource)).status).toBe('duplicate');
    expect(store.acquire(request({ ...resource, unknownField: 'different' })).status).toBe(
      'conflict',
    );
    expect(store.acquire(request({ ...resource, meta: { versionId: '2' } })).status).toBe(
      'acquired',
    );
    const foreign = { ...context, sourceNamespace: 'synthetic:other' };
    expect(
      store.acquire({ resource, patientContext: foreign, sourceNamespace: foreign.sourceNamespace })
        .status,
    ).toBe('acquired');
    expect(store.records()).toHaveLength(3);
    if (first.status === 'acquired') expect(store.records()[0]).toBe(first.record);
  });
});
