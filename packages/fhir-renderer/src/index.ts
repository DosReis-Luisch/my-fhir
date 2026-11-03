import {
  conceptText,
  patientName,
  resourceReference,
  type FhirResource,
  type StructureDefinition,
} from '@myfhir/fhir-core';
import type { ResourcePresentation } from './descriptor';
import { conditionSummary } from './condition';
import { diagnosticReportSummary } from './diagnosticReport';
import { imagingStudySummary } from './imagingStudy';
import { hasUnsupportedObservationResult, observationFields } from './observation';
import { addProfileMetadata, type ProfileInformedPresentation } from './profilePresentation';

export type { PresentationField, ResourcePresentation } from './descriptor';
export type { ProfileFieldHint, ProfileInformedPresentation } from './profilePresentation';

/** Opt-in metadata composition; the existing presentation and its fallback rules take priority. */
export function presentResourceWithProfiles(
  resource: FhirResource,
  definitions: readonly StructureDefinition[],
): ProfileInformedPresentation {
  return addProfileMetadata(presentResource(resource), definitions);
}

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
    case 'Condition': {
      const summary = conditionSummary(resource);
      if (!summary.supported) {
        return fallback(resource, [
          ...notices,
          'Recorded Condition assertion only; a diagnosis is not established by this application.',
          ...summary.issues,
        ]);
      }
      return {
        kind: 'condition',
        title: summary.title,
        subtitle: 'Recorded clinical assertion',
        fields: summary.fields,
        notices: [
          ...notices,
          'Source-supplied statuses are recorded assertions, including confirmed; no independent medical validation is performed.',
          'Missing abatement does not establish current activity. Dates retain source precision without date validation or conversion.',
          'Severity, stage, body sites and evidence are not clinically interpreted.',
        ],
        source: resource,
      };
    }
    case 'ImagingStudy': {
      const summary = imagingStudySummary(resource);
      if (!summary) {
        return fallback(resource, [
          ...notices,
          `Study status: ${resource.status}. Unsupported study metadata is not summarized.`,
        ]);
      }
      return {
        kind: 'imaging-study',
        title: summary.title,
        subtitle: `Imaging study metadata · ${resource.status}`,
        fields: summary.fields,
        notices: [
          ...notices,
          'Metadata only: study status does not prove a completed examination or accessible images. No image retrieval or viewing is implemented.',
          'Reported counts are source assertions; listed metadata may be partial. Dates are shown as supplied, without validation or conversion.',
        ],
        source: resource,
      };
    }
    case 'DiagnosticReport': {
      const summary = diagnosticReportSummary(resource);
      if (!summary) {
        return fallback(resource, [
          ...notices,
          `Report status: ${resource.status}. Only final reports with supported metadata can be summarized.`,
          'Unsupported report content is preserved in the original; narratives, conclusions and attachments are not interpreted.',
        ]);
      }
      return {
        kind: 'diagnostic-report',
        title: summary.title,
        subtitle: `Diagnostic report · ${resource.status}`,
        fields: summary.fields,
        notices: [
          ...notices,
          'Times are displayed as supplied, without date validation or conversion. Result and imaging-study references are resolved separately by the local catalog.',
        ],
        source: resource,
      };
    }
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
