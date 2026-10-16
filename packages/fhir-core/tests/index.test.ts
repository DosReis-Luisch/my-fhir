import { describe, expect, it } from 'vitest';
import {
  conceptText,
  isResource,
  ownField,
  patientName,
  resourceReference,
  resourceTypeOf,
  type Patient,
} from '../src/index';

describe('patientName', () => {
  it('prefers a usual name over an official or first name', () => {
    expect(
      patientName([
        { given: ['First'], family: 'Example' },
        { use: 'official', text: 'Official Example' },
        { use: 'usual', text: '  Alex Example  ' },
      ]),
    ).toBe('Alex Example');
  });

  it('uses the official name before the first name when no usual name exists', () => {
    expect(
      patientName([
        { text: 'First Example' },
        { use: 'official', given: ['Alex', 'Taylor'], family: 'Example' },
      ]),
    ).toBe('Alex Taylor Example');
  });

  it('uses the first name when no preferred use is supplied', () => {
    expect(patientName([{ given: ['Alex'], family: 'Example' }])).toBe('Alex Example');
  });

  it('labels missing names without inventing an identity', () => {
    expect(patientName(undefined)).toBe('Name not recorded');
    expect(patientName([])).toBe('Name not recorded');
    expect(patientName([{}])).toBe('Name not recorded');
  });
});

describe('native FHIR helpers', () => {
  it('discriminates resources and identifies a relative logical reference', () => {
    const patient: Patient = { resourceType: 'Patient', id: 'synthetic-patient' };
    expect(isResource(patient, 'Patient')).toBe(true);
    expect(isResource(patient, 'Observation')).toBe(false);
    expect(resourceReference(patient)).toBe('Patient/synthetic-patient');
    expect(resourceReference({ resourceType: 'Patient' })).toBeUndefined();
  });

  it('uses supplied concept text/display without interpreting a bare code', () => {
    expect(conceptText({ text: '  Supplied text  ', coding: [{ display: 'Display' }] })).toBe(
      'Supplied text',
    );
    expect(conceptText({ coding: [{ code: 'synthetic' }, { display: 'Display' }] })).toBe(
      'Display',
    );
    expect(conceptText({ coding: [{ code: 'synthetic' }] })).toBeUndefined();
  });

  it('inspects unknown input without claiming schema validation', () => {
    expect(ownField(null, 'id')).toBeUndefined();
    expect(ownField({ id: 'synthetic' }, 'id')).toBe('synthetic');
    expect(ownField({}, 'toString')).toBeUndefined();
    expect(resourceTypeOf({ resourceType: 'FutureResource' })).toBe('FutureResource');
    expect(resourceTypeOf({ resourceType: 42 })).toBeUndefined();
    expect(resourceTypeOf({ resourceType: ' ' })).toBeUndefined();
  });
});
