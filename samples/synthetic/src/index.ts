import type { Bundle, FhirResource, Organization } from '@myfhir/fhir-core';
import { observations } from './observations';
import { patient } from './patient';

export { observations } from './observations';
export { patient } from './patient';
export { conditions, conditionsContext } from './conditions';
export { imagingContext, imagingStudy, radiologyReport } from './imaging';
export { laboratoryContext, laboratoryObservations, laboratoryReport } from './laboratory';
export { weightHistory, weightHistoryContext } from './weightHistory';
export { syntheticPulseObservation, syntheticPulseProfile } from './vitalSignProfile';

export const organization = {
  resourceType: 'Organization',
  id: 'demo-care-centre',
  active: true,
  name: 'Example Care Centre (fictional)',
} satisfies Organization;

export const resources: FhirResource[] = [patient, ...observations, organization];

/** Native FHIR collection, not an application DTO or a server response. */
export const bundle: Bundle = {
  resourceType: 'Bundle',
  id: 'myfhir-synthetic-demo',
  type: 'collection',
  entry: resources.map((resource) => ({
    fullUrl: `https://myfhir.example/fhir/${resource.resourceType}/${resource.id}`,
    resource,
  })),
};
