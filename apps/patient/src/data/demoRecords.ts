import {
  isResource,
  resourceReference,
  type Observation,
  type Organization,
} from '@myfhir/fhir-core';
import { patient, resources } from '@myfhir/synthetic';

// Read-only selection of existing native resources, not a clinical model or an access policy.
const patientReference = resourceReference(patient);

export const demoPatientObservations: readonly Observation[] = resources.filter(
  (resource): resource is Observation =>
    patientReference !== undefined &&
    isResource(resource, 'Observation') &&
    resource.subject?.reference === patientReference,
);

// Demo context only: inclusion does not establish a care relationship with this Patient.
export const demoOrganizations: readonly Organization[] = resources.filter(
  (resource): resource is Organization => isResource(resource, 'Organization'),
);
