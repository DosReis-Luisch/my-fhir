import { conceptText, patientName, resourceReference, type FhirResource } from '@myfhir/fhir-core';
import type { ResourcePresentation } from './descriptor';
import { hasUnsupportedObservationResult, observationFields } from './observation';

export type { PresentationField, ResourcePresentation } from './descriptor';

// Modifier extensions may change the meaning of any element. Until supported,
// conservatively fall back rather than displaying potentially misleading facts.
function hasModifierExtension(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasModifierExtension);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(([key, child]) =>
    key === 'modifierExtension'
      ? !Array.isArray(child) || child.length > 0
      : hasModifierExtension(child),
  );
}

function fallback(resource: FhirResource, notices: string[]): ResourcePresentation {
  return {
    kind: 'generic',
    title: resource.resourceType,
    subtitle: resourceReference(resource) ?? 'Resource without a logical ID',
    fields: [],
    notices: [
      ...notices,
      'A summary is not available for this record. The original resource is preserved.',
    ],
    source: resource,
  };
}

/** Input must already be trusted R4 data. This function is not a validator. */
export function presentResource(resource: FhirResource): ResourcePresentation {
  const notices = [
    'This summary shows selected fields. Other fields and extensions are not interpreted.',
  ];
  if (resource.meta?.profile?.length) {
    notices.push('Declared profiles have not been resolved or validated.');
  }
  if (hasModifierExtension(resource)) {
    return fallback(resource, [
      ...notices,
      'This record contains a modifier extension that is not supported.',
    ]);
  }
  switch (resource.resourceType) {
    case 'Patient':
      return {
        kind: 'patient',
        title: patientName(resource.name),
        subtitle: 'Patient overview',
        fields: [
          {
            label: 'Date of birth',
            value: resource.birthDate ?? 'Not recorded',
            sourcePath: 'birthDate',
          },
          {
            label: 'Administrative gender',
            value: resource.gender ?? 'Not recorded',
            sourcePath: 'gender',
          },
        ],
        notices,
        source: resource,
      };
    case 'Observation':
      if (resource.status === 'entered-in-error' || resource.status === 'cancelled') {
        return fallback(resource, [
          ...notices,
          `Record status: ${resource.status}. Result is not displayed.`,
        ]);
      }
      if (hasUnsupportedObservationResult(resource)) {
        return fallback(resource, [
          ...notices,
          'A supplied result value is not supported in this view. See the original resource.',
        ]);
      }
      return {
        kind: 'observation',
        title: conceptText(resource.code) ?? 'Observation',
        subtitle: `Recorded measurement · ${resource.status}`,
        fields: observationFields(resource),
        notices,
        source: resource,
      };
    default:
      return fallback(resource, notices);
  }
}
