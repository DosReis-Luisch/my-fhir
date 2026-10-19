import type { ElementDefinition, ElementDefinitionType, StructureDefinition } from 'fhir/r4';

export type StructureDefinitionMetadata = Readonly<
  Pick<
    StructureDefinition,
    | 'url'
    | 'version'
    | 'name'
    | 'title'
    | 'description'
    | 'type'
    | 'kind'
    | 'derivation'
    | 'baseDefinition'
  >
>;

export type ElementTypeMetadata = Readonly<Pick<ElementDefinitionType, 'code' | 'versioning'>> & {
  readonly profile: readonly string[];
  readonly targetProfile: readonly string[];
};

export type ElementMetadata = Readonly<
  Pick<
    ElementDefinition,
    | 'id'
    | 'path'
    | 'min'
    | 'max'
    | 'short'
    | 'definition'
    | 'mustSupport'
    | 'isModifier'
    | 'isSummary'
    | 'sliceName'
  >
> & { readonly type: readonly ElementTypeMetadata[] };

export type StructureDefinitionInspection = {
  readonly metadata: StructureDefinitionMetadata;
  readonly validation: 'not-performed';
} & (
  | { readonly status: 'available'; readonly elements: readonly ElementMetadata[] }
  | { readonly status: 'unavailable'; readonly reason: 'snapshot-missing' | 'snapshot-empty' }
);

export function definitionMetadata(definition: StructureDefinition): StructureDefinitionMetadata {
  return Object.freeze({
    url: definition.url,
    version: definition.version,
    name: definition.name,
    title: definition.title,
    description: definition.description,
    type: definition.type,
    kind: definition.kind,
    derivation: definition.derivation,
    baseDefinition: definition.baseDefinition,
  });
}

/** Copies selected metadata only. Never derives, validates or repairs a snapshot. */
export function inspectStructureDefinition(
  definition: StructureDefinition,
): StructureDefinitionInspection {
  const metadata = definitionMetadata(definition);
  const elements = definition.snapshot?.element;
  if (!elements?.length) {
    return Object.freeze({
      status: 'unavailable',
      reason: elements ? 'snapshot-empty' : 'snapshot-missing',
      metadata,
      validation: 'not-performed',
    });
  }

  return Object.freeze({
    status: 'available',
    metadata,
    validation: 'not-performed',
    // Preserve order and every entry: path is not a unique element identifier.
    elements: Object.freeze(
      elements.map((element) =>
        Object.freeze({
          id: element.id,
          path: element.path,
          min: element.min,
          max: element.max,
          short: element.short,
          definition: element.definition,
          mustSupport: element.mustSupport,
          isModifier: element.isModifier,
          isSummary: element.isSummary,
          sliceName: element.sliceName,
          type: Object.freeze(
            (element.type ?? []).map((type) =>
              Object.freeze({
                code: type.code,
                versioning: type.versioning,
                profile: Object.freeze([...(type.profile ?? [])]),
                targetProfile: Object.freeze([...(type.targetProfile ?? [])]),
              }),
            ),
          ),
        }),
      ),
    ),
  });
}
