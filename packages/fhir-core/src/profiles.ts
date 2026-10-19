import type { FhirResource, StructureDefinition } from 'fhir/r4';
import {
  definitionMetadata,
  inspectStructureDefinition,
  type StructureDefinitionInspection,
  type StructureDefinitionMetadata,
} from './structureDefinition';

export type DeclaredProfileMatch = {
  readonly declared: string;
  readonly validation: 'not-performed';
} & (
  | { readonly status: 'resolved'; readonly definition: StructureDefinitionInspection }
  | { readonly status: 'ambiguous'; readonly candidates: readonly StructureDefinitionMetadata[] }
  | {
      readonly status: 'unresolved';
      readonly reason:
        | 'unsupported-canonical'
        | 'definition-missing'
        | 'version-mismatch'
        | 'resource-type-mismatch';
    }
);

/** Exact local identity matching only. Resolution does not establish conformance. */
export function matchDeclaredProfiles(
  resource: FhirResource,
  definitions: readonly StructureDefinition[],
): readonly DeclaredProfileMatch[] {
  return Object.freeze(
    (resource.meta?.profile ?? []).map((declared): DeclaredProfileMatch => {
      const common = { declared, validation: 'not-performed' as const };
      const [url, version, extra] = declared.split('|');
      // Fragments/contained references and malformed identifiers need a future resolver.
      // Do not trim, normalize case, replace schemes or select a "latest" version.
      if (!url || /[\s#]/.test(declared) || version === '' || extra !== undefined) {
        return Object.freeze({ ...common, status: 'unresolved', reason: 'unsupported-canonical' });
      }

      const sameUrl = definitions.filter((definition) => definition.url === url);
      const candidates = sameUrl.filter(
        (definition) => version === undefined || definition.version === version,
      );
      if (!candidates.length) {
        return Object.freeze({
          ...common,
          status: 'unresolved',
          reason: sameUrl.length ? 'version-mismatch' : 'definition-missing',
        });
      }
      if (candidates.length > 1) {
        return Object.freeze({
          ...common,
          status: 'ambiguous',
          candidates: Object.freeze(candidates.map(definitionMetadata)),
        });
      }

      const definition = candidates[0]!;
      if (definition.kind !== 'resource' || definition.type !== resource.resourceType) {
        return Object.freeze({ ...common, status: 'unresolved', reason: 'resource-type-mismatch' });
      }
      return Object.freeze({
        ...common,
        status: 'resolved',
        definition: inspectStructureDefinition(definition),
      });
    }),
  );
}
