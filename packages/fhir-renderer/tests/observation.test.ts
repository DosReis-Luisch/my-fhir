import { describe, expect, it } from 'vitest';
import type { Observation } from '@myfhir/fhir-core';
import { presentResource } from '../src/index';

// All cases are hand-authored fictional resources; no production/sample app dependency.
function observation(fields: Partial<Observation> = {}): Observation {
  return {
    resourceType: 'Observation',
    id: 'synthetic-observation',
    status: 'final',
    code: { text: 'Synthetic measurement' },
    ...fields,
  };
}

describe('Observation results', () => {
  it.each([
    { value: 0, expected: '0 kg' },
    { value: 72.4, expected: '72.4 kg' },
  ])('preserves quantity $value', ({ value, expected }) => {
    const presentation = presentResource(observation({ valueQuantity: { value, unit: 'kg' } }));
    expect(presentation.kind).toBe('observation');
    expect(presentation.fields).toContainEqual({
      label: 'Result',
      value: expected,
      sourcePath: 'valueQuantity',
    });
  });

  it.each(['<', '<=', '>=', '>'] as const)('preserves quantity comparator %s', (comparator) => {
    const presentation = presentResource(
      observation({ valueQuantity: { value: 0, comparator, unit: 'mg/L' } }),
    );
    expect(presentation.fields).toContainEqual({
      label: 'Result',
      value: `${comparator} 0 mg/L`,
      sourcePath: 'valueQuantity',
    });
  });

  it.each([
    { value: false, expected: 'No' },
    { value: true, expected: 'Yes' },
  ])('preserves boolean $value', ({ value, expected }) => {
    const presentation = presentResource(observation({ valueBoolean: value }));
    expect(presentation.kind).toBe('observation');
    expect(presentation.fields).toContainEqual({
      label: 'Result',
      value: expected,
      sourcePath: 'valueBoolean',
    });
  });

  it('retains the supported string, integer, and coded-display representations', () => {
    for (const [fields, value, sourcePath] of [
      [{ valueString: 'Supplied text' }, 'Supplied text', 'valueString'],
      [{ valueInteger: 0 }, '0', 'valueInteger'],
      [
        { valueCodeableConcept: { text: 'Supplied meaning' } },
        'Supplied meaning',
        'valueCodeableConcept',
      ],
    ] as const) {
      expect(presentResource(observation(fields)).fields).toContainEqual({
        label: 'Result',
        value,
        sourcePath,
      });
    }
  });

  it('presents blood-pressure components with independent units and source paths', () => {
    const presentation = presentResource(
      observation({
        code: { text: 'Blood pressure' },
        component: [
          { code: { text: 'Systolic' }, valueQuantity: { value: 118, unit: 'mmHg' } },
          { code: { text: 'Diastolic' }, valueQuantity: { value: 76, unit: 'mmHg' } },
        ],
      }),
    );
    expect(presentation.kind).toBe('observation');
    expect(presentation.fields).toEqual([
      { label: 'Systolic', value: '118 mmHg', sourcePath: 'component[0].valueQuantity' },
      { label: 'Diastolic', value: '76 mmHg', sourcePath: 'component[1].valueQuantity' },
      { label: 'Status', value: 'final', sourcePath: 'status' },
    ]);
  });

  it('labels a genuinely absent result unavailable', () => {
    const presentation = presentResource(observation());
    expect(presentation.kind).toBe('observation');
    expect(presentation.fields).toContainEqual({
      label: 'Result',
      value: 'Result unavailable in this view',
      sourcePath: 'resourceType',
    });
  });

  it('shows a supplied dataAbsentReason without manufacturing a result', () => {
    const presentation = presentResource(
      observation({ dataAbsentReason: { text: 'Not performed' } }),
    );
    expect(presentation.kind).toBe('observation');
    expect(presentation.fields).toContainEqual({
      label: 'Result',
      value: 'Not performed',
      sourcePath: 'dataAbsentReason',
    });
  });

  it('handles missing component results and their supplied absent reasons', () => {
    const presentation = presentResource(
      observation({
        component: [
          { code: { text: 'First component' } },
          { code: { text: 'Second component' }, dataAbsentReason: { text: 'Not performed' } },
        ],
      }),
    );
    expect(presentation.kind).toBe('observation');
    expect(presentation.fields).toEqual([
      {
        label: 'First component',
        value: 'Result unavailable in this view',
        sourcePath: 'component[0]',
      },
      { label: 'Second component', value: 'Not performed', sourcePath: 'component[1]' },
      { label: 'Status', value: 'final', sourcePath: 'status' },
    ]);
  });
});

describe('unsupported Observation results', () => {
  const unsupportedValues: Partial<Observation>[] = [
    { valueRange: { low: { value: 1 }, high: { value: 2 } } },
    { valueRatio: { numerator: { value: 1 }, denominator: { value: 2 } } },
    { valueSampledData: { origin: { value: 0 }, period: 1000, dimensions: 1, data: '1 2' } },
    { valueTime: '09:30:00' },
    { valueDateTime: '2026-10' },
    { valuePeriod: { start: '2026-10-01', end: '2026-10-02' } },
  ];

  it.each(unsupportedValues)('falls back for supplied unsupported value %j', (value) => {
    const resource = observation(value);
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.notices).toContain(
      'A supplied result value is not supported in this view. See the original resource.',
    );
    expect(presentation.source).toBe(resource);
    expect(presentation.source).toMatchObject(value);
  });

  it('falls back for mixed supported and unsupported components', () => {
    const resource = observation({
      component: [
        { code: { text: 'Supported' }, valueQuantity: { value: 0, unit: 'kg' } },
        { code: { text: 'Unsupported' }, valueRange: { low: { value: 1 } } },
      ],
    });
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.source).toBe(resource);
  });

  it('does not let an absence reason conceal a supplied unsupported value', () => {
    const resource = observation({
      valueRange: { low: { value: 1 } },
      dataAbsentReason: { text: 'Not performed' },
    });
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.source).toBe(resource);
  });

  it.each([
    { valueQuantity: { unit: 'kg' } },
    { valueCodeableConcept: { coding: [{ system: 'https://myfhir.example/codes', code: 'x' }] } },
    { valueString: '' },
    { valueQuantity: { value: 1 }, valueBoolean: false },
  ])('does not call a supplied but unsummarizable value absent: %j', (value) => {
    const presentation = presentResource(observation(value));
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
  });
});

describe('Observation time and status', () => {
  it.each(['2026', '2026-10', '2026-10-01', '2026-10-01T09:30:00.123+01:00'])(
    'labels clinically effective time and preserves %s verbatim',
    (effectiveDateTime) => {
      const presentation = presentResource(
        observation({ effectiveDateTime, issued: '2026-10-02T12:00:00Z', valueBoolean: false }),
      );
      expect(presentation.fields).toContainEqual({
        label: 'Clinically effective time',
        value: effectiveDateTime,
        sourcePath: 'effectiveDateTime',
      });
      expect(presentation.fields.some((field) => field.label === 'Recorded')).toBe(false);
    },
  );

  it.each(['cancelled', 'entered-in-error'] as const)('withholds results for %s', (status) => {
    const resource = observation({ status, valueQuantity: { value: 99, unit: 'kg' } });
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.notices).toContain(`Record status: ${status}. Result is not displayed.`);
    expect(presentation.source).toBe(resource);
  });
});
