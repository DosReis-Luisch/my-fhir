import { describe, expect, it } from 'vitest';
import type { FhirResource, Observation, Patient } from '@myfhir/fhir-core';
import { presentResource } from '../src/index';

describe('conservative fallback', () => {
  it('uses generic fallback for an unsupported R4 resource type', () => {
    const resource: FhirResource = { resourceType: 'Organization', id: 'synthetic-organization' };
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.title).toBe('Organization');
    expect(presentation.subtitle).toBe('Organization/synthetic-organization');
    expect(presentation.fields).toEqual([]);
    expect(presentation.source).toBe(resource);
  });

  it('falls back defensively for an unknown runtime resourceType', () => {
    // Deliberately outside the R4 union: verifies only defensive default dispatch.
    const resource = { resourceType: 'FutureResource', id: 'synthetic-future' };
    const presentation = presentResource(resource as unknown as FhirResource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.title).toBe('FutureResource');
    expect(presentation.fields).toEqual([]);
    expect(presentation.source).toBe(resource);
  });

  it('falls back when a root modifier extension could alter clinical meaning', () => {
    const resource: Patient = {
      resourceType: 'Patient',
      name: [{ text: 'Synthetic Person' }],
      modifierExtension: [{ url: 'https://myfhir.example/modifier', valueBoolean: true }],
    };
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('generic');
    expect(presentation.fields).toEqual([]);
    expect(presentation.notices).toContain(
      'This record contains a modifier extension that is not supported.',
    );
    expect(presentation.source).toBe(resource);
  });

  it('falls back for a modifier extension nested in a component', () => {
    const resource: Observation = {
      resourceType: 'Observation',
      status: 'final',
      code: { text: 'Synthetic panel' },
      component: [
        {
          code: { text: 'Synthetic component' },
          valueBoolean: false,
          modifierExtension: [{ url: 'https://myfhir.example/modifier', valueBoolean: true }],
        },
      ],
    };
    expect(presentResource(resource).kind).toBe('generic');
  });
});

describe('source preservation and unresolved profiles', () => {
  it('retains profile declarations and explicitly disclaims profile resolution', () => {
    const resource: Patient = {
      resourceType: 'Patient',
      meta: { profile: ['https://myfhir.example/StructureDefinition/synthetic-patient'] },
    };
    const presentation = presentResource(resource);
    expect(presentation.kind).toBe('patient');
    expect(presentation.notices).toContain(
      'Declared profiles have not been resolved or validated.',
    );
    expect(presentation.source).toBe(resource);
    expect(presentation.source.meta?.profile).toEqual(resource.meta?.profile);
  });

  it('preserves source, extensions and unknown properties without interpretation', () => {
    const resource = {
      resourceType: 'Patient' as const,
      id: 'synthetic-patient',
      name: [{ text: 'Synthetic Person' }],
      extension: [
        { url: 'https://myfhir.example/unhandled', valueString: 'Uninterpreted extension' },
      ],
      futureProperty: { value: 'Uninterpreted future property' },
    };
    const before = JSON.stringify(resource);
    const presentation = presentResource(resource);

    expect(presentation.source).toBe(resource);
    expect(presentation.source).toHaveProperty('extension', resource.extension);
    expect(presentation.source).toHaveProperty('futureProperty', resource.futureProperty);
    expect(JSON.stringify(resource)).toBe(before);
    expect(presentation.fields.some((field) => field.value.startsWith('Uninterpreted'))).toBe(
      false,
    );
    expect(presentation.notices).toContain(
      'This summary shows selected fields. Other fields and extensions are not interpreted.',
    );
  });
});
