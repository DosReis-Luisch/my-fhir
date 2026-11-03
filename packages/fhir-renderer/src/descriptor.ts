import type { FhirResource } from '@myfhir/fhir-core';

export interface PresentationField {
  readonly label: string;
  readonly value: string;
  /** FHIR element path relative to the source; not a FHIRPath expression. */
  readonly sourcePath: string;
}

/** Disposable view information, never a replacement clinical data model. */
export interface ResourcePresentation {
  readonly kind: 'patient' | 'observation' | 'diagnostic-report' | 'imaging-study' | 'generic';
  readonly title: string;
  readonly subtitle: string;
  readonly fields: readonly PresentationField[];
  readonly notices: readonly string[];
  /** Original object, including unhandled fields and extensions. Do not mutate. */
  readonly source: FhirResource;
}
