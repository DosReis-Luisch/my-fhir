import type { CodeableConcept, FhirResource, HumanName } from 'fhir/r4';

// Explicit R4 entry point: never mix R4, R4B, and R5 definitions.
export type {
  Bundle,
  CodeableConcept,
  HumanName,
  Observation,
  Organization,
  Patient,
  Quantity,
  FhirResource,
  StructureDefinition,
  ElementDefinition,
} from 'fhir/r4';

export { inspectStructureDefinition } from './structureDefinition';
export type {
  ElementMetadata,
  ElementTypeMetadata,
  StructureDefinitionInspection,
  StructureDefinitionMetadata,
} from './structureDefinition';
export { matchDeclaredProfiles } from './profiles';
export type { DeclaredProfileMatch } from './profiles';

export function isResource<T extends FhirResource['resourceType']>(
  resource: FhirResource,
  resourceType: T,
): resource is Extract<FhirResource, { resourceType: T }> {
  return resource.resourceType === resourceType;
}

/** Relative logical identity, not a globally unique key across FHIR servers. */
export function resourceReference(resource: FhirResource): string | undefined {
  return resource.id ? `${resource.resourceType}/${resource.id}` : undefined;
}

/** Prefer supplied display text. No terminology lookup or inferred meaning. */
export function conceptText(concept: CodeableConcept | undefined): string | undefined {
  return (
    concept?.text?.trim() ||
    concept?.coding?.find((coding) => coding.display?.trim())?.display?.trim()
  );
}

export function patientName(names: HumanName[] | undefined): string {
  const name =
    names?.find((item) => item.use === 'usual') ??
    names?.find((item) => item.use === 'official') ??
    names?.[0];
  return (
    name?.text?.trim() ||
    [...(name?.given ?? []), name?.family].filter(Boolean).join(' ') ||
    'Name not recorded'
  );
}

/** Safe shallow access without converting untrusted input into a validated resource. */
export function ownField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, key)) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key];
}

/** A minimal boundary check only; this is NOT FHIR schema/profile validation. */
export function resourceTypeOf(value: unknown): string | undefined {
  const resourceType = ownField(value, 'resourceType');
  return typeof resourceType === 'string' && resourceType.trim() ? resourceType : undefined;
}
