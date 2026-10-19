import {
  matchDeclaredProfiles,
  type DeclaredProfileMatch,
  type ElementMetadata,
  type StructureDefinition,
  type StructureDefinitionMetadata,
} from '@myfhir/fhir-core';
import type { ResourcePresentation } from './descriptor';

export interface ProfileFieldHint {
  readonly sourcePath: 'valueQuantity' | 'effectiveDateTime';
  readonly declared: string;
  readonly profile: StructureDefinitionMetadata;
  /** Detached snapshot metadata, never an interpreted clinical fact or a FHIRPath expression. */
  readonly element: ElementMetadata;
}

export interface ProfileInformedPresentation {
  readonly presentation: ResourcePresentation;
  readonly profiles: readonly DeclaredProfileMatch[];
  readonly fieldHints: readonly ProfileFieldHint[];
  readonly limitations: readonly string[];
  readonly validation: 'not-performed';
}

const mappings = [
  { sourcePath: 'valueQuantity', path: 'Observation.value[x]', type: 'Quantity' },
  { sourcePath: 'effectiveDateTime', path: 'Observation.effective[x]', type: 'dateTime' },
] as const;

/** Internal composition helper. Matching and snapshot inspection remain owned by fhir-core. */
export function addProfileMetadata(
  presentation: ResourcePresentation,
  definitions: readonly StructureDefinition[],
): ProfileInformedPresentation {
  const profiles = matchDeclaredProfiles(presentation.source, definitions);
  const fieldHints: ProfileFieldHint[] = [];
  const limitations = [
    'Resolution and available snapshot metadata do not establish conformance or snapshot completeness.',
    'Hints are optional display metadata; clinical labels, terminology and values remain unchanged.',
    'Base presentation notices remain profile-unaware; local resolution results are reported separately.',
  ];

  for (const profile of profiles) {
    if (profile.status === 'unresolved') {
      limitations.push(`Profile ${profile.declared} is unresolved: ${profile.reason}.`);
    } else if (profile.status === 'ambiguous') {
      limitations.push(`Profile ${profile.declared} has ambiguous matching definitions.`);
    } else if (profile.definition.status === 'unavailable') {
      limitations.push(
        `Profile ${profile.declared} metadata is unavailable: ${profile.definition.reason}.`,
      );
    }
  }

  const finish = (): ProfileInformedPresentation =>
    Object.freeze({
      presentation,
      profiles,
      fieldHints: Object.freeze(fieldHints),
      limitations: Object.freeze(limitations),
      validation: 'not-performed',
    });

  if (presentation.kind !== 'observation') {
    limitations.push(
      'Field hints require an Observation presentation; existing fallback takes priority.',
    );
    return finish();
  }
  if (profiles.length !== 1) {
    limitations.push(
      profiles.length
        ? 'Multiple profile declarations suppress field hints; no precedence is assigned.'
        : 'No profile is declared; no profile-specific field hints are available.',
    );
    return finish();
  }
  const profile = profiles[0]!;
  if (profile.status !== 'resolved' || profile.definition.status !== 'available') return finish();

  const { elements, metadata } = profile.definition;
  // Recover the uniquely resolved source through the same core matcher, rather than
  // duplicating canonical/version rules. Inspection omits slicing/modifier extensions.
  const definition = definitions.find(
    (candidate) =>
      matchDeclaredProfiles(presentation.source, [candidate])[0]?.status === 'resolved',
  );
  if (!definition || definition.modifierExtension?.length) {
    limitations.push(
      'Profile source metadata is unavailable or contains unsupported modifier extensions.',
    );
    return finish();
  }
  for (const mapping of mappings) {
    // No field creation: even a required snapshot element cannot supply an absent resource value.
    if (!presentation.fields.some((field) => field.sourcePath === mapping.sourcePath)) continue;
    const candidates = elements.filter((element) => element.path === mapping.path);
    const element = candidates[0];
    const sourceElement = definition.snapshot?.element.find((entry) => entry.path === mapping.path);
    if (
      candidates.length !== 1 ||
      !element ||
      element.id !== mapping.path ||
      element.sliceName !== undefined ||
      element.isModifier === true ||
      sourceElement?.slicing !== undefined ||
      sourceElement?.modifierExtension?.length ||
      elements.filter((candidate) => candidate.id === element.id).length !== 1 ||
      element.type.filter((type) => type.code === mapping.type).length !== 1
    ) {
      limitations.push(
        `No unique supported unsliced, non-modifier mapping for ${mapping.sourcePath}.`,
      );
      continue;
    }
    fieldHints.push(
      Object.freeze({
        sourcePath: mapping.sourcePath,
        declared: profile.declared,
        profile: metadata,
        element,
      }),
    );
  }
  return finish();
}
