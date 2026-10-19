import { describe, expect, it } from 'vitest';
import type { ElementDefinition, Observation, StructureDefinition } from '@myfhir/fhir-core';
// Root Vitest tests can consume the synthetic workspace; production renderer code cannot.
import { syntheticPulseObservation, syntheticPulseProfile } from '@myfhir/synthetic';
import { presentResource, presentResourceWithProfiles } from '../src/index';

const url = syntheticPulseProfile.url;
const declaration = `${url}|1.0.0`;

function observation(fields: Partial<Observation> = {}): Observation {
  return { ...structuredClone(syntheticPulseObservation), ...fields };
}

function definition(fields: Partial<StructureDefinition> = {}): StructureDefinition {
  return { ...structuredClone(syntheticPulseProfile), ...fields };
}

function withValueElements(...elements: ElementDefinition[]): StructureDefinition {
  return definition({ snapshot: { element: elements } });
}

const valueElement: ElementDefinition = {
  id: 'Observation.value[x]',
  path: 'Observation.value[x]',
  type: [{ code: 'Quantity' }],
  short: 'Optional profile text, not a clinical label',
  mustSupport: true,
};

describe('opt-in profile-informed presentation', () => {
  it('composes the synthetic pulse example without changing existing presentation', () => {
    const expected = presentResource(syntheticPulseObservation);
    const result = presentResourceWithProfiles(syntheticPulseObservation, [syntheticPulseProfile]);
    expect(result.presentation).toEqual(expected);
    expect(result.presentation.source).toBe(syntheticPulseObservation);
    expect(presentResource(syntheticPulseObservation)).toEqual(expected);
    expect(result.profiles[0]).toMatchObject({
      declared: declaration,
      status: 'resolved',
      validation: 'not-performed',
    });
    expect(result.fieldHints).toHaveLength(2);
    expect(result.fieldHints).toContainEqual(
      expect.objectContaining({
        sourcePath: 'valueQuantity',
        declared: declaration,
        profile: expect.objectContaining({ url, version: '1.0.0' }),
        element: expect.objectContaining({
          id: 'Observation.value[x]',
          path: 'Observation.value[x]',
          short: 'Synthetic pulse rate as a quantity',
          mustSupport: true,
        }),
      }),
    );
    expect(result.fieldHints).toContainEqual(
      expect.objectContaining({
        sourcePath: 'effectiveDateTime',
        element: expect.objectContaining({
          path: 'Observation.effective[x]',
          type: [expect.objectContaining({ code: 'dateTime' })],
        }),
      }),
    );
    expect(result.presentation.title).toBe('Heart rate');
    expect(result.presentation.fields[0]).toMatchObject({ label: 'Result', value: '68 beats/min' });
    expect(result.validation).toBe('not-performed');
    expect(result.limitations.join(' ')).toContain('do not establish conformance');
  });

  it('does not invent required values or fields from profile elements', () => {
    const resource = observation({ valueQuantity: undefined, effectiveDateTime: undefined });
    const result = presentResourceWithProfiles(resource, [definition()]);
    expect(result.presentation).toEqual(presentResource(resource));
    expect(result.fieldHints).toEqual([]);
    expect(result.presentation.fields[0]?.value).toBe('Result unavailable in this view');
  });

  it('does not map booleans or component quantities to the top-level Quantity choice', () => {
    for (const fields of [
      { valueQuantity: undefined, valueBoolean: false },
      {
        valueQuantity: undefined,
        component: [{ code: { text: 'Synthetic component' }, valueQuantity: { value: 0 } }],
      },
    ]) {
      const resource = observation({ ...fields, effectiveDateTime: undefined });
      const result = presentResourceWithProfiles(resource, [definition()]);
      expect(result.fieldHints).toEqual([]);
      expect(result.presentation).toEqual(presentResource(resource));
    }
  });

  it('keeps non-Observation presentation intact without hints', () => {
    const resource = { resourceType: 'Patient' as const, name: [{ text: 'Synthetic Person' }] };
    const result = presentResourceWithProfiles(resource, []);
    expect(result.presentation).toEqual(presentResource(resource));
    expect(result.fieldHints).toEqual([]);
  });

  it('reports no declared profiles', () => {
    const result = presentResourceWithProfiles(observation({ meta: undefined }), [definition()]);
    expect(result.profiles).toEqual([]);
    expect(result.fieldHints).toEqual([]);
    expect(result.limitations.join(' ')).toContain('No profile is declared');
  });

  it.each([
    { definitions: [], reason: 'definition-missing' },
    { definitions: [definition({ version: '2.0.0' })], reason: 'version-mismatch' },
    { definitions: [definition({ type: 'Patient' })], reason: 'resource-type-mismatch' },
  ])('reports unresolved profiles: $reason', ({ definitions, reason }) => {
    const resource = observation();
    const result = presentResourceWithProfiles(resource, definitions);
    expect(result.presentation).toEqual(presentResource(resource));
    expect(result.fieldHints).toEqual([]);
    expect(result.profiles[0]).toMatchObject({ status: 'unresolved', reason });
    expect(result.limitations.join(' ')).toContain(reason);
  });

  it('reports ambiguous definitions without choosing a version', () => {
    const resource = observation({ meta: { profile: [url] } });
    const result = presentResourceWithProfiles(resource, [
      definition(),
      definition({ version: '2.0.0' }),
    ]);
    expect(result.profiles[0]?.status).toBe('ambiguous');
    expect(result.fieldHints).toEqual([]);
    expect(result.limitations.join(' ')).toContain('ambiguous');
  });

  it.each([
    [declaration, `${url}|2.0.0`],
    [declaration, declaration],
    [declaration, 'https://myfhir.example/missing'],
  ])('does not assign precedence between declarations %j', (...profiles) => {
    const resource = observation({ meta: { profile: profiles } });
    const result = presentResourceWithProfiles(resource, [
      definition(),
      definition({ version: '2.0.0' }),
    ]);
    expect(result.profiles.map((profile) => profile.declared)).toEqual(profiles);
    expect(result.fieldHints).toEqual([]);
    expect(result.limitations.join(' ')).toContain('Multiple profile declarations');
    expect(result.presentation).toEqual(presentResource(resource));
  });

  it.each([
    { snapshot: undefined, reason: 'snapshot-missing' },
    { snapshot: { element: [] }, reason: 'snapshot-empty' },
  ])('separates resolved identity from unavailable metadata: $reason', ({ snapshot, reason }) => {
    const result = presentResourceWithProfiles(observation(), [definition({ snapshot })]);
    expect(result.profiles[0]).toMatchObject({
      status: 'resolved',
      definition: { status: 'unavailable', reason },
    });
    expect(result.fieldHints).toEqual([]);
    expect(result.limitations.join(' ')).toContain(reason);
  });
});

describe('conservative element correspondence', () => {
  it.each([
    { name: 'missing element', elements: [] },
    { name: 'missing ID', elements: [{ ...valueElement, id: undefined }] },
    { name: 'slice name', elements: [{ ...valueElement, sliceName: 'pulse' }] },
    { name: 'sliced ID', elements: [{ ...valueElement, id: 'Observation.value[x]:pulse' }] },
    { name: 'modifier', elements: [{ ...valueElement, isModifier: true }] },
    { name: 'slicing entry', elements: [{ ...valueElement, slicing: { rules: 'open' as const } }] },
    { name: 'wrong type', elements: [{ ...valueElement, type: [{ code: 'string' }] }] },
    { name: 'missing type', elements: [{ ...valueElement, type: undefined }] },
    {
      name: 'duplicate type',
      elements: [{ ...valueElement, type: [{ code: 'Quantity' }, { code: 'Quantity' }] }],
    },
    {
      name: 'duplicate path',
      elements: [valueElement, { ...valueElement, id: 'Observation.value[x]:other' }],
    },
    {
      name: 'duplicate ID',
      elements: [valueElement, { ...valueElement, path: 'Observation.other' }],
    },
    {
      name: 'element modifier extension',
      elements: [
        {
          ...valueElement,
          modifierExtension: [{ url: 'https://myfhir.example/modifier', valueBoolean: true }],
        },
      ],
    },
  ])('withholds hints for $name', ({ elements }) => {
    const resource = observation({ effectiveDateTime: undefined });
    const result = presentResourceWithProfiles(resource, [withValueElements(...elements)]);
    expect(result.fieldHints).toEqual([]);
    expect(result.presentation).toEqual(presentResource(resource));
    expect(result.limitations).not.toHaveLength(0);
  });

  it('requires dateTime type for the effective[x] correspondence', () => {
    const resource = observation({ valueQuantity: undefined });
    const result = presentResourceWithProfiles(resource, [
      withValueElements({
        id: 'Observation.effective[x]',
        path: 'Observation.effective[x]',
        type: [{ code: 'Period' }],
      }),
    ]);
    expect(result.fieldHints).toEqual([]);
  });

  it('keeps a unique effective-time hint when the result element mapping is ambiguous', () => {
    const result = presentResourceWithProfiles(observation(), [
      withValueElements(
        valueElement,
        { ...valueElement, id: 'Observation.value[x]:other' },
        {
          id: 'Observation.effective[x]',
          path: 'Observation.effective[x]',
          type: [{ code: 'dateTime' }],
        },
      ),
    ]);
    expect(result.fieldHints.map((hint) => hint.sourcePath)).toEqual(['effectiveDateTime']);
  });

  it('uses core resolution with unrelated definitions in any input order', () => {
    const resource = observation();
    const matching = definition();
    const unrelated = definition({ url: 'https://myfhir.example/unrelated' });
    const result = presentResourceWithProfiles(resource, [unrelated, matching]);
    expect(result).toEqual(presentResourceWithProfiles(resource, [matching, unrelated]));
    expect(result.fieldHints).toHaveLength(2);
  });

  it('accepts explicit false flags and a choice containing the matching type', () => {
    const result = presentResourceWithProfiles(observation({ effectiveDateTime: undefined }), [
      withValueElements({
        ...valueElement,
        isModifier: false,
        mustSupport: false,
        type: [{ code: 'Quantity' }, { code: 'string' }],
      }),
    ]);
    expect(result.fieldHints).toHaveLength(1);
    expect(result.fieldHints[0]?.element.mustSupport).toBe(false);
  });

  it('withholds hints for definition-level modifier extensions', () => {
    const result = presentResourceWithProfiles(observation(), [
      definition({
        modifierExtension: [{ url: 'https://myfhir.example/modifier', valueBoolean: true }],
      }),
    ]);
    expect(result.fieldHints).toEqual([]);
  });
});

describe('fallback priority and preservation', () => {
  it.each([
    { status: 'cancelled' as const },
    { status: 'entered-in-error' as const },
    { valueQuantity: undefined, valueRange: { low: { value: 1 } } },
    { modifierExtension: [{ url: 'https://myfhir.example/modifier', valueBoolean: true }] },
    {
      component: [
        {
          code: { text: 'Synthetic component' },
          modifierExtension: [{ url: 'https://myfhir.example/modifier', valueBoolean: true }],
        },
      ],
    },
  ])('never makes an existing fallback displayable: %j', (fields) => {
    const resource = observation(fields);
    const result = presentResourceWithProfiles(resource, [definition()]);
    expect(result.presentation).toEqual(presentResource(resource));
    expect(result.presentation.kind).toBe('generic');
    expect(result.fieldHints).toEqual([]);
    expect(result.profiles[0]?.status).toBe('resolved');
  });

  it('preserves caller input and returns detached frozen hints without freezing source', () => {
    const resource = {
      ...observation(),
      extension: [
        { url: 'https://myfhir.example/uninterpreted', valueString: 'Original extension' },
      ],
      futureProperty: { value: 'Original unknown property' },
    };
    const profile = definition();
    const before = JSON.stringify({ resource, profile });
    const result = presentResourceWithProfiles(resource, [profile]);
    expect(JSON.stringify({ resource, profile })).toBe(before);
    expect(result.presentation.source).toBe(resource);
    expect(result.presentation.source).toHaveProperty('extension', resource.extension);
    expect(result.presentation.source).toHaveProperty('futureProperty', resource.futureProperty);
    expect(Object.isFrozen(resource)).toBe(false);
    expect(Object.isFrozen(profile)).toBe(false);
    expect(Object.isFrozen(profile.snapshot?.element)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.fieldHints)).toBe(true);
    expect(Object.isFrozen(result.fieldHints[0])).toBe(true);
    expect(Object.isFrozen(result.fieldHints[0]?.element)).toBe(true);
    expect(Object.isFrozen(result.fieldHints[0]?.element.type)).toBe(true);
    expect(Object.isFrozen(result.fieldHints[0]?.profile)).toBe(true);
    expect(Object.isFrozen(result.limitations)).toBe(true);
    const element = profile.snapshot?.element.find(
      (entry) => entry.path === 'Observation.value[x]',
    );
    if (!element) throw new Error('Expected synthetic value element');
    element.short = 'Changed by caller';
    expect(result.fieldHints[0]?.element.short).toBe('Synthetic pulse rate as a quantity');
    expect(result.validation).toBe('not-performed');
  });
});
