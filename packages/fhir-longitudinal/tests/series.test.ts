import { describe, expect, it } from 'vitest';
import { createAcquisitionStore, type AcquiredResource } from '@myfhir/fhir-acquisition';
import type { Observation } from '@myfhir/fhir-core';
import { analyzeQuantitySeries, type QuantitySeriesRequest } from '../src/index';

const selection: QuantitySeriesRequest = {
  patientContext: { sourceNamespace: 'synthetic:source-a', patientId: 'fictional-patient' },
  measurement: {
    coding: { system: 'urn:synthetic:measurements', code: 'pulse' },
    unit: { system: 'urn:synthetic:units', code: 'beats/min' },
  },
};

function acquired(
  id: string,
  fields: Record<string, unknown> = {},
  context = selection.patientContext,
): AcquiredResource {
  const resource: Observation = {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: { coding: [{ ...selection.measurement.coding }], text: 'Fictional measurement' },
    subject: { reference: `Patient/${context.patientId}` },
    valueQuantity: { value: 68, ...selection.measurement.unit, unit: 'supplied label' },
    effectiveDateTime: '2026-01-01T09:00:00Z',
  };
  const result = createAcquisitionStore().acquire({
    sourceNamespace: context.sourceNamespace,
    patientContext: context,
    resource: { ...resource, ...fields },
  });
  if (result.status !== 'acquired') throw new Error(`Fixture rejected: ${result.status}`);
  return result.record;
}

describe('longitudinal coded Quantity observations', () => {
  it('produces a genuine ordered series independently of acquisition order', () => {
    const records = [
      acquired('day-four', { effectiveDateTime: '2026-01-04T09:00:00Z' }),
      acquired('day-two', {
        effectiveDateTime: '2026-01-02T09:00:00+01:00',
        valueQuantity: { value: 67, ...selection.measurement.unit },
      }),
      acquired('day-one'),
      acquired('day-three', {
        effectiveDateTime: '2026-01-03T09:00:00.125Z',
        valueQuantity: { value: 69, ...selection.measurement.unit },
      }),
    ];
    const result = analyzeQuantitySeries(records, selection);
    expect(result.points.map((point) => point.record.metadata.identity.logicalId)).toEqual([
      'day-one',
      'day-two',
      'day-three',
      'day-four',
    ]);
    expect(result.points.map((point) => point.value)).toEqual([68, 67, 69, 68]);
    expect(result.points[1]?.effectiveDateTime).toBe('2026-01-02T09:00:00+01:00');
    expect(result.exclusions).toEqual([]);
    expect(analyzeQuantitySeries([...records].reverse(), selection)).toEqual(result);
    expect(result.measurement).toEqual(selection.measurement);
    expect(result.patientContext).toEqual(selection.patientContext);
  });

  it('sorts by actual instants with deterministic identity tie breaking', () => {
    const records = [
      acquired('later', { effectiveDateTime: '2026-01-01T08:30:00Z' }),
      acquired('b', { effectiveDateTime: '2026-01-01T10:00:00+02:00' }),
      acquired('a', { effectiveDateTime: '2026-01-01T10:00:00+02:00' }),
    ];
    expect(
      analyzeQuantitySeries(records, selection).points.map(
        (point) => point.record.metadata.identity.logicalId,
      ),
    ).toEqual(['a', 'b', 'later']);
  });

  it('isolates sources and patients even when bare Patient and Observation IDs match', () => {
    const local = acquired('same-id');
    const otherSource = acquired(
      'same-id',
      {},
      {
        ...selection.patientContext,
        sourceNamespace: 'synthetic:source-b',
      },
    );
    const otherPatient = acquired(
      'another-event',
      {},
      {
        ...selection.patientContext,
        patientId: 'other-patient',
      },
    );
    const result = analyzeQuantitySeries([otherSource, otherPatient, local], selection);
    expect(result.points.map((point) => point.record)).toEqual([local]);
    expect(result.exclusions.map((entry) => entry.reason).sort()).toEqual([
      'patient-mismatch',
      'source-mismatch',
    ]);
    expect(result.authorization).toBe('not-checked');
    expect(result.limitations.join(' ')).toContain('not authorization');
  });

  it.each([
    { coding: [{ system: 'urn:synthetic:other', code: 'pulse' }] },
    { coding: [{ ...selection.measurement.coding, code: 'different' }] },
    { text: 'pulse' },
    { coding: null },
    { coding: [{ ...selection.measurement.coding, version: '1' }] },
    {
      coding: [
        { ...selection.measurement.coding },
        { system: 'urn:synthetic:other', code: 'other' },
      ],
    },
  ])('excludes mismatched/ambiguous coding without using display text: %j', (code) => {
    const result = analyzeQuantitySeries([acquired('coding', { code })], selection);
    expect(result.points).toHaveLength(0);
    expect(result.exclusions[0]?.reason).toBe('coding-mismatch-or-ambiguity');
  });

  it.each([
    { value: 68, unit: 'beats/min' },
    { value: 68, ...selection.measurement.unit, code: 'other', unit: 'beats/min' },
    { value: 68, ...selection.measurement.unit, system: 'urn:synthetic:other' },
  ])(
    'excludes unsupported units rather than matching labels or converting: %j',
    (valueQuantity) => {
      const result = analyzeQuantitySeries([acquired('unit', { valueQuantity })], selection);
      expect(result.points).toHaveLength(0);
      expect(result.exclusions[0]?.reason).toBe('unit-mismatch');
    },
  );

  it.each(['specimen', 'method', 'bodySite'])('excludes unsupported %s context', (field) => {
    const result = analyzeQuantitySeries([acquired('context', { [field]: {} })], selection);
    expect(result.exclusions[0]?.reason).toBe('unsupported-measurement-context');
    expect(result.points).toHaveLength(0);
  });

  it.each([
    ['2026', 'unsupported-effective-time'],
    ['2026-01', 'unsupported-effective-time'],
    ['2026-01-01', 'unsupported-effective-time'],
    ['2026-01-01T09:00:00', 'unsupported-effective-time'],
    ['2026-01-01T09:00Z', 'unsupported-effective-time'],
    ['2026-02-30T09:00:00Z', 'unsupported-effective-time'],
    ['2025-02-29T09:00:00Z', 'unsupported-effective-time'],
    ['2026-01-01T24:00:00Z', 'unsupported-effective-time'],
    ['2026-01-01T09:00:60Z', 'unsupported-effective-time'],
    ['2026-01-01T09:00:00-00:00', 'unsupported-effective-time'],
    ['2026-01-01T09:00:00+14:01', 'unsupported-effective-time'],
    ['2026-01-01T09:00:00.1234Z', 'unsupported-effective-time'],
    ['2026-01-01T09:00:00Z\n', 'unsupported-effective-time'],
    [null, 'unsupported-effective-time'],
  ] as const)(
    'preserves uncertainty instead of inventing a timestamp: %s',
    (effectiveDateTime, reason) => {
      const record = acquired('time', { effectiveDateTime });
      const result = analyzeQuantitySeries([record], selection);
      expect(result.points).toHaveLength(0);
      expect(result.exclusions[0]).toEqual({ record, reason });
    },
  );

  it('reports absent effective time and unsupported alternative/competing time forms', () => {
    const base = acquired('base').resource;
    if (base.resourceType !== 'Observation') throw new Error('Expected Observation fixture.');
    const { effectiveDateTime: omitted, ...withoutTime } = base;
    expect(omitted).toBeDefined();
    const missing = createAcquisitionStore().acquire({
      sourceNamespace: selection.patientContext.sourceNamespace,
      patientContext: selection.patientContext,
      resource: withoutTime,
    });
    if (missing.status !== 'acquired') throw new Error('Fixture rejected.');
    expect(analyzeQuantitySeries([missing.record], selection).exclusions[0]?.reason).toBe(
      'missing-effective-time',
    );
    expect(
      analyzeQuantitySeries(
        [acquired('period', { effectivePeriod: { start: '2026-01-01' } })],
        selection,
      ).exclusions[0]?.reason,
    ).toBe('unsupported-effective-time');
  });

  it('accepts a valid leap-day timestamp without changing its precision', () => {
    const result = analyzeQuantitySeries(
      [acquired('leap', { effectiveDateTime: '2024-02-29T09:00:00.1+00:00' })],
      selection,
    );
    expect(result.points[0]?.effectiveDateTime).toBe('2024-02-29T09:00:00.1+00:00');
  });

  it.each([{}, { value: null }, { value: '68' }, { value: false }])(
    'excludes missing or nonnumeric values: %j',
    (valueQuantity) => {
      const result = analyzeQuantitySeries([acquired('value', { valueQuantity })], selection);
      expect(result.points).toHaveLength(0);
      expect(result.exclusions[0]?.reason).toBe('missing-or-nonnumeric-value');
    },
  );

  it('retains zero as a finite value', () => {
    expect(
      analyzeQuantitySeries(
        [acquired('zero', { valueQuantity: { value: 0, ...selection.measurement.unit } })],
        selection,
      ).points[0]?.value,
    ).toBe(0);
  });

  it('reports absent valueQuantity and guards against nonfinite values in a forged snapshot', () => {
    const base = acquired('base');
    if (base.resource.resourceType !== 'Observation')
      throw new Error('Expected Observation fixture.');
    const resource = base.resource;
    const { valueQuantity: omitted, ...withoutQuantity } = resource;
    expect(omitted).toBeDefined();
    const missing = createAcquisitionStore().acquire({
      sourceNamespace: selection.patientContext.sourceNamespace,
      patientContext: selection.patientContext,
      resource: withoutQuantity,
    });
    if (missing.status !== 'acquired') throw new Error('Fixture rejected.');
    expect(analyzeQuantitySeries([missing.record], selection).exclusions[0]?.reason).toBe(
      'missing-or-nonnumeric-value',
    );
    // Acquisition itself rejects nonfinite JSON numbers. Exercise the defensive engine guard
    // separately without weakening the real acquisition boundary.
    for (const value of [NaN, Infinity, -Infinity]) {
      const forged: AcquiredResource = Object.freeze({
        ...base,
        resource: Object.freeze({
          ...resource,
          valueQuantity: Object.freeze({ value, ...selection.measurement.unit }),
        }),
      });
      const result = analyzeQuantitySeries([forged], selection);
      expect(result.points).toHaveLength(0);
      expect(result.exclusions[0]?.reason).toBe('missing-or-nonnumeric-value');
    }
  });

  it.each(['<', '<=', '>', '>='])(
    'does not treat comparator %s as an exact value',
    (comparator) => {
      const result = analyzeQuantitySeries(
        [
          acquired('comparator', {
            valueQuantity: { value: 5, comparator, ...selection.measurement.unit },
          }),
        ],
        selection,
      );
      expect(result.points).toHaveLength(0);
      expect(result.exclusions[0]?.reason).toBe('comparator-not-exact');
    },
  );

  it.each([
    'registered',
    'preliminary',
    'amended',
    'corrected',
    'cancelled',
    'entered-in-error',
    'unknown',
  ])('supports only final status, excluding %s', (status) => {
    const result = analyzeQuantitySeries([acquired('status', { status })], selection);
    expect(result.points).toHaveLength(0);
    expect(result.exclusions[0]?.reason).toBe('unsupported-status');
  });

  it.each([
    { modifierExtension: [{ url: 'https://synthetic.example/modifier', valueBoolean: true }] },
    {
      valueQuantity: {
        value: 68,
        ...selection.measurement.unit,
        extension: [{ url: 'https://synthetic.example/outer', modifierExtension: [{}] }],
      },
    },
    { code: { coding: [{ ...selection.measurement.coding, modifierExtension: {} }] } },
  ])('does not interpret unsupported modifier semantics anywhere: %j', (fields) => {
    const result = analyzeQuantitySeries([acquired('modifier', fields)], selection);
    expect(result.points).toHaveLength(0);
    expect(result.exclusions[0]?.reason).toBe('modifier-extension');
  });

  it.each([
    { valueString: '68' },
    { valueRange: { low: { value: 60 }, high: { value: 70 } } },
    { component: [] },
    { dataAbsentReason: {} },
  ])('rejects unsafe competing/component/absence forms: %j', (fields) => {
    const result = analyzeQuantitySeries([acquired('form', fields)], selection);
    expect(result.points).toHaveLength(0);
    expect(result.exclusions[0]?.reason).toBe('unsupported-value-form');
  });

  it('excludes every retained revision without choosing the highest-looking version', () => {
    const records = [
      acquired('revised', { meta: { versionId: '10' } }),
      acquired('revised', { meta: { versionId: '2' }, status: 'cancelled' }),
      acquired('independent'),
    ];
    const result = analyzeQuantitySeries(records, selection);
    expect(result.points.map((point) => point.record.metadata.identity.logicalId)).toEqual([
      'independent',
    ]);
    expect(result.exclusions.map((entry) => entry.reason)).toEqual([
      'multiple-retained-versions',
      'multiple-retained-versions',
    ]);
    expect(analyzeQuantitySeries([...records].reverse(), selection)).toEqual(result);
  });

  it('treats unversioned and versioned revisions as ambiguous, including a changed patient context', () => {
    const result = analyzeQuantitySeries(
      [
        acquired('reassigned'),
        acquired(
          'reassigned',
          { meta: { versionId: '1' } },
          {
            ...selection.patientContext,
            patientId: 'other-patient',
          },
        ),
      ],
      selection,
    );
    expect(result.points).toHaveLength(0);
    expect(result.exclusions.map((entry) => entry.reason).sort()).toEqual([
      'multiple-retained-versions',
      'patient-mismatch',
    ]);
  });

  it('does not double-count repeated identity/version snapshots from separate collections', () => {
    const records = [
      acquired('repeated'),
      acquired('repeated', { valueQuantity: { value: 70, ...selection.measurement.unit } }),
    ];
    const result = analyzeQuantitySeries(records, selection);
    expect(result.points).toHaveLength(0);
    expect(result.exclusions.map((entry) => entry.reason)).toEqual([
      'repeated-observation-identity',
      'repeated-observation-identity',
    ]);
    expect(analyzeQuantitySeries([...records].reverse(), selection)).toEqual(result);
  });

  it('preserves equal-valued independent events and exact acquired references without mutation', () => {
    const a = acquired('a', {
      extraUnknown: { original: true },
      extension: [{ url: 'https://synthetic.example/preserved', valueString: 'unknown' }],
    });
    const b = acquired('b');
    const records = Object.freeze([b, a]);
    const before = JSON.stringify(records);
    const result = analyzeQuantitySeries(records, selection);
    expect(result.points).toHaveLength(2);
    expect(result.points[0]?.record).toBe(a);
    expect(result.points[1]?.record).toBe(b);
    expect(result.points[0]?.record.metadata.identity).toBe(a.metadata.identity);
    expect(JSON.stringify(records)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.points)).toBe(true);
    expect(Object.isFrozen(result.points[0])).toBe(true);
    expect(Object.isFrozen(result.measurement.coding)).toBe(true);
    expect(Object.isFrozen(selection)).toBe(false);
    expect(result.validation).toBe('selection-guards-only');
  });

  it('excludes Patient records and provides an explicit empty result', () => {
    const store = createAcquisitionStore();
    store.acquire({
      sourceNamespace: selection.patientContext.sourceNamespace,
      patientContext: selection.patientContext,
      resource: { resourceType: 'Patient', id: selection.patientContext.patientId },
    });
    expect(analyzeQuantitySeries(store.records(), selection).exclusions[0]?.reason).toBe(
      'not-observation',
    );
    expect(analyzeQuantitySeries([], selection).points).toEqual([]);
  });

  it('requires explicit valid selection without defaulting to another patient, coding or unit', () => {
    expect(() =>
      analyzeQuantitySeries([], {
        ...selection,
        measurement: { ...selection.measurement, coding: { system: '', code: 'pulse' } },
      }),
    ).toThrow(RangeError);
  });
});
