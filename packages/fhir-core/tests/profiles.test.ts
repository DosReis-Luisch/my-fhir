import { describe, expect, it } from 'vitest';
import {
  inspectStructureDefinition,
  matchDeclaredProfiles,
  type Observation,
  type StructureDefinition,
} from '../src/index';

const url = 'https://myfhir.example/StructureDefinition/test-pulse';

function definition(fields: Partial<StructureDefinition> = {}): StructureDefinition {
  return {
    resourceType: 'StructureDefinition',
    url,
    name: 'SyntheticPulse',
    status: 'draft',
    kind: 'resource',
    abstract: false,
    type: 'Observation',
    snapshot: { element: [{ id: 'Observation', path: 'Observation', min: 0, max: '*' }] },
    ...fields,
  };
}

function observation(...profiles: string[]): Observation {
  return {
    resourceType: 'Observation',
    status: 'final',
    code: { text: 'Synthetic pulse' },
    meta: { profile: profiles },
  };
}

describe('StructureDefinition inspection', () => {
  it('extracts metadata without confusing the definition resourceType with its type', () => {
    const result = inspectStructureDefinition(
      definition({
        version: '1.0.0',
        title: 'Fictional pulse profile',
        description: 'Synthetic metadata only',
        derivation: 'constraint',
        baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
      }),
    );
    expect(result.status).toBe('available');
    expect(result.validation).toBe('not-performed');
    expect(result.metadata).toEqual({
      url,
      version: '1.0.0',
      name: 'SyntheticPulse',
      title: 'Fictional pulse profile',
      description: 'Synthetic metadata only',
      type: 'Observation',
      kind: 'resource',
      derivation: 'constraint',
      baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Observation',
    });
  });

  it('preserves cardinality, flags, descriptions and declared type metadata', () => {
    const result = inspectStructureDefinition(
      definition({
        snapshot: {
          element: [
            {
              id: 'Observation.subject',
              path: 'Observation.subject',
              min: 0,
              max: '1',
              short: 'Subject',
              definition: 'The fictional subject',
              mustSupport: false,
              isModifier: false,
              isSummary: true,
              type: [
                {
                  code: 'Reference',
                  profile: ['https://myfhir.example/StructureDefinition/reference'],
                  targetProfile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
                  versioning: 'either',
                },
              ],
            },
            { path: 'Observation.component', min: 1, max: '*' },
            { path: 'Observation.note', min: 0, max: '0' },
          ],
        },
      }),
    );
    expect(result.status).toBe('available');
    if (result.status !== 'available') throw new Error('Expected snapshot metadata');
    expect(result.elements[0]).toEqual({
      id: 'Observation.subject',
      path: 'Observation.subject',
      min: 0,
      max: '1',
      short: 'Subject',
      definition: 'The fictional subject',
      mustSupport: false,
      isModifier: false,
      isSummary: true,
      sliceName: undefined,
      type: [
        {
          code: 'Reference',
          profile: ['https://myfhir.example/StructureDefinition/reference'],
          targetProfile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
          versioning: 'either',
        },
      ],
    });
    expect(result.elements[1]).toMatchObject({ min: 1, max: '*' });
    expect(result.elements[2]).toMatchObject({ min: 0, max: '0' });
  });

  it('keeps repeated paths, distinct IDs and slice names in snapshot order', () => {
    const elements = [
      { id: 'Observation.component', path: 'Observation.component' },
      { id: 'Observation.component:first', path: 'Observation.component', sliceName: 'first' },
      { id: 'Observation.component:second', path: 'Observation.component', sliceName: 'second' },
    ];
    const result = inspectStructureDefinition(definition({ snapshot: { element: elements } }));
    if (result.status !== 'available') throw new Error('Expected snapshot metadata');
    expect(result.elements.map(({ id, path, sliceName }) => ({ id, path, sliceName }))).toEqual(
      elements.map((element) => ({ ...element, sliceName: element.sliceName })),
    );
  });

  it('leaves optional metadata absent instead of deriving defaults', () => {
    const result = inspectStructureDefinition(
      definition({ snapshot: { element: [{ path: 'Observation' }] } }),
    );
    expect(result.metadata.version).toBeUndefined();
    expect(result.metadata.title).toBeUndefined();
    expect(result.metadata.description).toBeUndefined();
    expect(result.metadata.derivation).toBeUndefined();
    if (result.status !== 'available') throw new Error('Expected snapshot metadata');
    expect(result.elements[0]).toMatchObject({ path: 'Observation', type: [] });
    expect(result.elements[0]?.id).toBeUndefined();
    expect(result.elements[0]?.min).toBeUndefined();
    expect(result.elements[0]?.max).toBeUndefined();
    expect(result.elements[0]?.mustSupport).toBeUndefined();
  });

  it('reports a missing snapshot without interpreting the differential', () => {
    const result = inspectStructureDefinition(
      definition({
        snapshot: undefined,
        differential: { element: [{ path: 'Observation.value[x]', min: 1 }] },
      }),
    );
    expect(result).toMatchObject({
      status: 'unavailable',
      reason: 'snapshot-missing',
      validation: 'not-performed',
    });
    expect(result).not.toHaveProperty('elements');
  });

  it('reports an explicitly empty snapshot honestly', () => {
    expect(inspectStructureDefinition(definition({ snapshot: { element: [] } }))).toMatchObject({
      status: 'unavailable',
      reason: 'snapshot-empty',
    });
  });

  it('does not enforce declared cardinalities or other conformance rules', () => {
    const result = inspectStructureDefinition(
      definition({ snapshot: { element: [{ path: 'Observation', min: 2, max: '1' }] } }),
    );
    expect(result.status).toBe('available');
    expect(result.validation).toBe('not-performed');
  });

  it('returns detached, deeply frozen metadata without mutating or freezing input', () => {
    const type = { code: 'Reference', profile: ['https://myfhir.example/profile'] };
    const resource = definition({
      snapshot: { element: [{ path: 'Observation.subject', type: [type] }] },
    });
    const before = JSON.stringify(resource);
    const result = inspectStructureDefinition(resource);
    expect(JSON.stringify(resource)).toBe(before);
    expect(Object.isFrozen(resource)).toBe(false);
    if (result.status !== 'available') throw new Error('Expected snapshot metadata');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.metadata)).toBe(true);
    expect(Object.isFrozen(result.elements)).toBe(true);
    expect(Object.isFrozen(result.elements[0])).toBe(true);
    expect(Object.isFrozen(result.elements[0]?.type)).toBe(true);
    expect(Object.isFrozen(result.elements[0]?.type[0])).toBe(true);
    expect(Object.isFrozen(result.elements[0]?.type[0]?.profile)).toBe(true);
    expect(Object.isFrozen(result.elements[0]?.type[0]?.targetProfile)).toBe(true);
    type.profile.push('https://myfhir.example/another');
    expect(result.elements[0]?.type[0]?.profile).toEqual(['https://myfhir.example/profile']);
  });
});

describe('declared profile matching', () => {
  it('returns no claims when meta or profile declarations are absent', () => {
    expect(matchDeclaredProfiles({ resourceType: 'Patient' }, [definition()])).toEqual([]);
    expect(matchDeclaredProfiles({ resourceType: 'Patient', meta: {} }, [])).toEqual([]);
    expect(matchDeclaredProfiles(observation(), [definition()])).toEqual([]);
  });

  it('resolves a single unversioned URL match, without validating the observation', () => {
    // The resource intentionally lacks the value a profile might require.
    const matches = matchDeclaredProfiles(observation(url), [definition({ version: '1.0.0' })]);
    expect(matches[0]).toMatchObject({
      declared: url,
      status: 'resolved',
      validation: 'not-performed',
      definition: { status: 'available', validation: 'not-performed' },
    });
  });

  it('matches the exact business version, independently of candidate order', () => {
    const one = definition({ version: '1.0.0' });
    const two = definition({ version: '2.0.0' });
    const resource = observation(`${url}|1.0.0`);
    const matches = matchDeclaredProfiles(resource, [two, one]);
    expect(matches).toEqual(matchDeclaredProfiles(resource, [one, two]));
    expect(matches[0]).toMatchObject({
      status: 'resolved',
      definition: { metadata: { version: '1.0.0' } },
    });
  });

  it('resolves a single definition without a version for an unversioned declaration', () => {
    expect(matchDeclaredProfiles(observation(url), [definition()])[0]).toMatchObject({
      status: 'resolved',
      definition: { metadata: { url, version: undefined } },
    });
  });

  it('distinguishes a missing definition from a version mismatch', () => {
    expect(matchDeclaredProfiles(observation(url), [])[0]).toMatchObject({
      status: 'unresolved',
      reason: 'definition-missing',
    });
    for (const known of [definition(), definition({ version: '2.0.0' })]) {
      expect(matchDeclaredProfiles(observation(`${url}|1.0.0`), [known])[0]).toMatchObject({
        status: 'unresolved',
        reason: 'version-mismatch',
      });
    }
  });

  it('does not guess the latest version for an unversioned declaration', () => {
    const matches = matchDeclaredProfiles(observation(url), [
      definition({ version: '1.0.0' }),
      definition({ version: '2.0.0' }),
    ]);
    expect(matches[0]).toMatchObject({ status: 'ambiguous', validation: 'not-performed' });
    if (matches[0]?.status !== 'ambiguous') throw new Error('Expected ambiguity');
    expect(matches[0].candidates.map((candidate) => candidate.version)).toEqual(['1.0.0', '2.0.0']);
    expect(Object.isFrozen(matches[0].candidates)).toBe(true);
    expect(Object.isFrozen(matches[0].candidates[0])).toBe(true);
  });

  it('reports duplicates of the same URL/version as ambiguous', () => {
    const known = definition({ version: '1.0.0' });
    expect(matchDeclaredProfiles(observation(`${url}|1.0.0`), [known, known])[0]).toMatchObject({
      status: 'ambiguous',
    });
  });

  it.each([{ type: 'Patient' }, { kind: 'logical' as const }])(
    'rejects a definition for the wrong resource kind/type: %j',
    (fields) => {
      expect(matchDeclaredProfiles(observation(url), [definition(fields)])[0]).toMatchObject({
        status: 'unresolved',
        reason: 'resource-type-mismatch',
        validation: 'not-performed',
      });
    },
  );

  it('keeps canonical resolution separate from snapshot availability', () => {
    expect(
      matchDeclaredProfiles(observation(url), [definition({ snapshot: undefined })])[0],
    ).toMatchObject({
      status: 'resolved',
      validation: 'not-performed',
      definition: { status: 'unavailable', reason: 'snapshot-missing' },
    });
  });

  it.each(['', `${url}|`, `${url}|1|2`, `${url}#fragment`, '#contained', ` ${url}`])(
    'honestly rejects unsupported or malformed canonical %j',
    (declared) => {
      expect(matchDeclaredProfiles(observation(declared), [definition()])[0]).toEqual({
        declared,
        status: 'unresolved',
        reason: 'unsupported-canonical',
        validation: 'not-performed',
      });
    },
  );

  it('does not normalize URL case or schemes', () => {
    const profiles = observation(url.replace('https:', 'http:'), url.toUpperCase());
    expect(matchDeclaredProfiles(profiles, [definition()]).map((match) => match.status)).toEqual([
      'unresolved',
      'unresolved',
    ]);
  });

  it('preserves declaration order and duplicates without mutation', () => {
    const resource = observation(url, `${url}|1.0.0`, url);
    const definitions = [definition({ version: '1.0.0' })];
    const before = JSON.stringify({ resource, definitions });
    const matches = matchDeclaredProfiles(resource, definitions);
    expect(JSON.stringify({ resource, definitions })).toBe(before);
    expect(matches.map((match) => match.declared)).toEqual(resource.meta?.profile);
    expect(Object.isFrozen(matches)).toBe(true);
    expect(matches.every((match) => Object.isFrozen(match))).toBe(true);
    expect(matches.every((match) => match.validation === 'not-performed')).toBe(true);
    expect(Object.isFrozen(definitions[0])).toBe(false);
    definitions[0]!.title = 'Changed by caller';
    expect(matches[0]).toMatchObject({ definition: { metadata: { title: undefined } } });
  });
});
