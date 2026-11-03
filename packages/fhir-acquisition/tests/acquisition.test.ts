import { describe, expect, it } from 'vitest';
import type { Observation, Patient } from '@myfhir/fhir-core';
import { createAcquisitionStore, type AcquisitionRequest } from '../src/index';

function patient(fields: Partial<Patient> = {}): Patient {
  return { resourceType: 'Patient', id: 'synthetic-patient', ...fields };
}

function observation(fields: Partial<Observation> = {}): Observation {
  return {
    resourceType: 'Observation',
    id: 'synthetic-pulse',
    status: 'final',
    code: { text: 'Synthetic pulse' },
    subject: { reference: 'Patient/synthetic-patient' },
    valueQuantity: { value: 68, unit: 'beats/min' },
    ...fields,
  };
}

function request(
  resource: unknown,
  sourceNamespace = 'synthetic:source-a',
  patientId = 'synthetic-patient',
): AcquisitionRequest {
  return { sourceNamespace, patientContext: { sourceNamespace, patientId }, resource };
}

describe('source-aware synthetic acquisition', () => {
  it('acquires a Patient and Observation with separate identity, version and patient metadata', () => {
    const store = createAcquisitionStore();
    expect(store.acquire(request(patient())).status).toBe('acquired');
    const result = store.acquire(request(observation({ meta: { versionId: 'v1' } })));
    expect(result.status).toBe('acquired');
    expect(result).toMatchObject({
      validation: 'basic-guards-only',
      fhirValidation: 'not-performed',
      authorization: 'not-checked',
    });
    if (result.status !== 'acquired') throw new Error('Expected acquisition.');
    expect(result.record.metadata).toEqual({
      validation: 'basic-guards-only',
      fhirValidation: 'not-performed',
      authorization: 'not-checked',
      identity: {
        sourceNamespace: 'synthetic:source-a',
        resourceType: 'Observation',
        logicalId: 'synthetic-pulse',
      },
      versionId: 'v1',
      patientContext: { sourceNamespace: 'synthetic:source-a', patientId: 'synthetic-patient' },
    });
    expect(store.records()).toHaveLength(2);
  });

  it('keeps identical IDs and content from different sources distinct', () => {
    const store = createAcquisitionStore();
    for (const source of ['synthetic:source-a', 'synthetic:source-b']) {
      expect(store.acquire(request(patient(), source)).status).toBe('acquired');
      expect(store.acquire(request(observation(), source)).status).toBe('acquired');
    }
    expect(store.records()).toHaveLength(4);
  });

  it('keeps the same logical ID for different resource types distinct', () => {
    const store = createAcquisitionStore();
    store.acquire(request(patient()));
    expect(store.acquire(request(observation({ id: 'synthetic-patient' }))).status).toBe(
      'acquired',
    );
    expect(store.records()).toHaveLength(2);
  });

  it('rejects a context from another source even with the same patient ID', () => {
    const store = createAcquisitionStore();
    expect(
      store.acquire({
        ...request(observation()),
        patientContext: { sourceNamespace: 'synthetic:source-b', patientId: 'synthetic-patient' },
      }),
    ).toMatchObject({ status: 'rejected', reason: 'source-context-mismatch' });
    expect(store.records()).toHaveLength(0);
  });

  it('rejects Patient and Observation resources outside the explicit patient context', () => {
    const store = createAcquisitionStore();
    for (const resource of [patient(), observation()]) {
      expect(
        store.acquire(request(resource, 'synthetic:source-a', 'another-patient')),
      ).toMatchObject({
        status: 'rejected',
        reason: 'patient-context-mismatch',
      });
    }
    expect(store.records()).toHaveLength(0);
  });

  it('does not require or guess a Patient resource from batch order', () => {
    const store = createAcquisitionStore();
    expect(store.acquire(request(observation())).status).toBe('acquired');
    expect(store.acquire(request(patient())).status).toBe('acquired');
  });

  it('treats reordered object keys as unchanged content and keeps one record', () => {
    const store = createAcquisitionStore();
    const first = store.acquire(request(patient({ meta: { versionId: '1' }, active: true })));
    const repeated = store.acquire(
      request({
        active: true,
        meta: { versionId: '1' },
        id: 'synthetic-patient',
        resourceType: 'Patient',
      }),
    );
    expect(repeated.status).toBe('duplicate');
    if (first.status !== 'acquired' || repeated.status !== 'duplicate') {
      throw new Error('Expected acquisition then duplicate.');
    }
    expect(repeated.record).toBe(first.record);
    expect(store.records()).toHaveLength(1);
  });

  it('does not overwrite conflicting content under the same identity/version', () => {
    const store = createAcquisitionStore();
    const original = observation({ meta: { versionId: '1' } });
    store.acquire(request(original));
    const result = store.acquire(
      request({ ...original, valueQuantity: { value: 80, unit: 'beats/min' } }),
    );
    expect(result).toMatchObject({
      status: 'conflict',
      reason: 'identity-version-content-conflict',
    });
    if (result.status !== 'conflict') throw new Error('Expected conflict.');
    expect(result.existing.resource).toEqual(original);
    expect(store.records()).toHaveLength(1);
  });

  it('retains version changes separately without selecting a latest revision', () => {
    const store = createAcquisitionStore();
    for (const version of ['2', '1']) {
      expect(store.acquire(request(observation({ meta: { versionId: version } }))).status).toBe(
        'acquired',
      );
    }
    expect(store.records().map((record) => record.metadata.versionId)).toEqual(['2', '1']);
  });

  it('compares unversioned repeats conservatively and keeps absent version distinct', () => {
    const store = createAcquisitionStore();
    expect(store.acquire(request(patient())).status).toBe('acquired');
    expect(store.acquire(request(patient())).status).toBe('duplicate');
    expect(store.acquire(request(patient({ active: true }))).status).toBe('conflict');
    expect(store.acquire(request(patient({ meta: { versionId: '1' } }))).status).toBe('acquired');
    expect(store.records().map((record) => record.metadata.versionId)).toEqual([undefined, '1']);
  });

  it('does not collapse independent observations with equal values', () => {
    const store = createAcquisitionStore();
    store.acquire(request(observation()));
    expect(store.acquire(request(observation({ id: 'another-event' }))).status).toBe('acquired');
    expect(store.records()).toHaveLength(2);
  });

  it.each([
    [{}, 'missing-patient-reference'],
    [{ subject: {} }, 'missing-patient-reference'],
    [{ subject: null }, 'ambiguous-patient-reference'],
    [{ subject: [{ reference: 'Patient/synthetic-patient' }] }, 'ambiguous-patient-reference'],
    [{ subject: { identifier: { value: 'synthetic-id' } } }, 'ambiguous-patient-reference'],
    [
      {
        subject: { reference: 'Patient/synthetic-patient', identifier: { value: 'synthetic-id' } },
      },
      'ambiguous-patient-reference',
    ],
  ] as const)('rejects missing or ambiguous patient association: %j', (fields, reason) => {
    const { subject: omitted, ...withoutSubject } = observation();
    expect(omitted).toBeDefined();
    const store = createAcquisitionStore();
    expect(store.acquire(request({ ...withoutSubject, ...fields }))).toMatchObject({
      status: 'rejected',
      reason,
    });
    expect(store.records()).toHaveLength(0);
  });

  it.each([
    'synthetic-patient',
    '#synthetic-patient',
    'urn:uuid:synthetic-patient',
    'Patient/synthetic-patient/_history/1',
    'https://synthetic.example/Patient/synthetic-patient',
    'Group/synthetic-patient',
    'Patient/synthetic-patient ',
    'Patient/synthetic-patient\n',
  ])('does not guess the source or meaning of unsupported reference %s', (reference) => {
    expect(
      createAcquisitionStore().acquire(request(observation({ subject: { reference } }))),
    ).toMatchObject({ status: 'rejected', reason: 'unsupported-patient-reference' });
  });

  it('rejects conflicting reference type metadata', () => {
    expect(
      createAcquisitionStore().acquire(
        request(
          observation({ subject: { reference: 'Patient/synthetic-patient', type: 'Group' } }),
        ),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'unsupported-patient-reference' });
  });

  it('preserves unknown fields, extensions, dates and identifiers in a detached frozen resource', () => {
    const store = createAcquisitionStore();
    const original = {
      ...observation(),
      effectiveDateTime: '2026-01',
      identifier: [{ system: 'urn:synthetic:measurement', value: 'original-id' }],
      extension: [{ url: 'https://synthetic.example/extra', valueString: 'unchanged' }],
      extraUnknown: { values: [0, false, null, 'original'] },
    };
    const result = store.acquire(request(original));
    if (result.status !== 'acquired') throw new Error('Expected acquisition.');
    expect(result.record.resource).toEqual(original);
    expect(result.record.resource).not.toBe(original);
    expect(Object.isFrozen(original)).toBe(false);
    expect(Object.isFrozen(original.extraUnknown)).toBe(false);
    expect(Object.isFrozen(result.record.resource)).toBe(true);
    expect(Object.isFrozen(Reflect.get(result.record.resource, 'extraUnknown'))).toBe(true);
    expect(Object.isFrozen(store.records())).toBe(true);
    original.extraUnknown.values[3] = 'caller changed';
    original.valueQuantity!.value = 99;
    expect(Reflect.get(result.record.resource, 'extraUnknown')).toEqual({
      values: [0, false, null, 'original'],
    });
    expect(store.acquire(request(original)).status).toBe('conflict');
  });

  it('accepts frozen inputs without freezing or modifying caller-owned metadata', () => {
    const context = { sourceNamespace: 'synthetic:source-a', patientId: 'synthetic-patient' };
    const result = createAcquisitionStore().acquire({
      sourceNamespace: context.sourceNamespace,
      patientContext: context,
      resource: Object.freeze(patient()),
    });
    expect(result.status).toBe('acquired');
    expect(Object.isFrozen(context)).toBe(false);
    context.patientId = 'changed-after-acquisition';
    if (result.status !== 'acquired') throw new Error('Expected acquisition.');
    expect(result.record.metadata.patientContext.patientId).toBe('synthetic-patient');
  });

  it('retains modifiers and unsupported clinical forms without claiming interpretation or validation', () => {
    const resource = observation({
      modifierExtension: [{ url: 'https://synthetic.example/modifier', valueBoolean: true }],
      valueRange: { low: { value: 1 }, high: { value: 2 } },
    });
    const result = createAcquisitionStore().acquire(request(resource));
    expect(result).toMatchObject({ status: 'acquired', fhirValidation: 'not-performed' });
    if (result.status !== 'acquired') throw new Error('Expected acquisition.');
    expect(result.record.resource).toEqual(resource);
    // Acquisition does not invoke a renderer, validate value choices or bypass its fallbacks.
  });

  it.each([
    [null, 'unsupported-resource-type'],
    [[], 'unsupported-resource-type'],
    [{ resourceType: 'Bundle', type: 'collection', entry: [] }, 'unsupported-resource-type'],
    [{ resourceType: 'Organization', id: 'synthetic-org' }, 'unsupported-resource-type'],
    [patient({ id: '' }), 'invalid-resource-id'],
    [patient({ id: 'not/a/logical-id' }), 'invalid-resource-id'],
    [patient({ id: 'synthetic-patient\n' }), 'invalid-resource-id'],
    [{ resourceType: 'Patient' }, 'invalid-resource-id'],
    [{ ...patient(), id: 42 }, 'invalid-resource-id'],
    [patient({ meta: { versionId: '' } }), 'invalid-version'],
    [{ ...patient(), meta: { versionId: 1 } }, 'invalid-version'],
    [{ ...patient(), meta: [] }, 'invalid-version'],
    [{ ...observation(), status: 'invented-status' }, 'invalid-observation-shape'],
    [{ ...observation(), code: null }, 'invalid-observation-shape'],
  ] as const)('reports unsupported or malformed input explicitly: %j', (resource, reason) => {
    const store = createAcquisitionStore();
    expect(store.acquire(request(resource))).toMatchObject({
      status: 'rejected',
      reason,
      fhirValidation: 'not-performed',
      authorization: 'not-checked',
    });
    expect(store.records()).toHaveLength(0);
  });

  it.each([undefined, NaN, Infinity, new Date('2026-01-01'), () => 1, BigInt(1)])(
    'rejects non-JSON fields rather than silently stripping/changing them: %s',
    (extraUnknown) => {
      expect(
        createAcquisitionStore().acquire(request({ ...patient(), extraUnknown })),
      ).toMatchObject({
        status: 'rejected',
        reason: 'unsupported-json-input',
      });
    },
  );

  it('rejects cycles, sparse arrays and accessors without evaluating a getter', () => {
    const cyclic: Record<string, unknown> = { ...patient() };
    cyclic.self = cyclic;
    let getterCalled = false;
    const accessor = Object.defineProperty(patient(), 'extraUnknown', {
      enumerable: true,
      get() {
        getterCalled = true;
        return 'not data';
      },
    });
    for (const resource of [cyclic, { ...patient(), extraUnknown: new Array(2) }, accessor]) {
      expect(createAcquisitionStore().acquire(request(resource))).toMatchObject({
        status: 'rejected',
        reason: 'unsupported-json-input',
      });
    }
    expect(getterCalled).toBe(false);
  });

  it('does not turn custom array properties into clinical values', () => {
    const extraUnknown = new Array(1);
    Object.defineProperty(extraUnknown, '4294967295', { enumerable: true, value: 'synthetic' });
    expect(createAcquisitionStore().acquire(request({ ...patient(), extraUnknown }))).toMatchObject(
      {
        status: 'rejected',
        reason: 'unsupported-json-input',
      },
    );
  });

  it('treats changes to unknown fields and array order as content conflicts', () => {
    const store = createAcquisitionStore();
    store.acquire(request({ ...patient(), extraUnknown: ['first', 'second'] }));
    expect(store.acquire(request({ ...patient(), extraUnknown: ['second', 'first'] })).status).toBe(
      'conflict',
    );
    expect(store.records()).toHaveLength(1);
  });

  it('bounds recursive input inspection', () => {
    let extraUnknown: unknown = 'synthetic';
    for (let depth = 0; depth < 70; depth++) extraUnknown = { child: extraUnknown };
    expect(createAcquisitionStore().acquire(request({ ...patient(), extraUnknown }))).toMatchObject(
      {
        status: 'rejected',
        reason: 'unsupported-json-input',
      },
    );
    expect(
      createAcquisitionStore().acquire(
        request({ ...patient(), extraUnknown: Array(10001).fill(0) }),
      ),
    ).toMatchObject({ status: 'rejected', reason: 'unsupported-json-input' });
  });

  it('rejects invalid context instead of inventing one', () => {
    for (const source of ['', ' synthetic:source-a']) {
      expect(createAcquisitionStore().acquire(request(patient(), source))).toMatchObject({
        status: 'rejected',
        reason: 'invalid-context',
      });
    }
    expect(
      createAcquisitionStore().acquire(request(patient(), 'synthetic:source-a', '')),
    ).toMatchObject({
      status: 'rejected',
      reason: 'invalid-context',
    });
  });
});
