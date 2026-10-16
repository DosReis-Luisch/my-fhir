import { describe, expect, it } from 'vitest';
import type { Patient } from '@myfhir/fhir-core';
import { presentResource } from '../src/index';

describe('Patient presentation', () => {
  it('selects the supplied usual name and demographic fields', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      name: [
        { use: 'official', text: 'Alex Taylor Example' },
        { use: 'usual', given: ['Alex'], family: 'Example' },
      ],
      birthDate: '1990-04',
      gender: 'unknown',
    };
    const presentation = presentResource(patient);

    expect(presentation.kind).toBe('patient');
    expect(presentation.title).toBe('Alex Example');
    expect(presentation.fields).toEqual([
      { label: 'Date of birth', value: '1990-04', sourcePath: 'birthDate' },
      { label: 'Administrative gender', value: 'unknown', sourcePath: 'gender' },
    ]);
  });

  it('labels missing demographics without deriving values', () => {
    const presentation = presentResource({ resourceType: 'Patient' });
    expect(presentation.title).toBe('Name not recorded');
    expect(presentation.fields).toEqual([
      { label: 'Date of birth', value: 'Not recorded', sourcePath: 'birthDate' },
      { label: 'Administrative gender', value: 'Not recorded', sourcePath: 'gender' },
    ]);
  });
});
