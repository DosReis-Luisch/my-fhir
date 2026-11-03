import { createAcquisitionStore } from '@myfhir/fhir-acquisition';
import { buildClinicalCatalog, type CatalogItem } from '@myfhir/fhir-catalog';
import type { FhirResource } from '@myfhir/fhir-core';
import {
  imagingContext,
  imagingStudy,
  radiologyReport,
  laboratoryContext,
  laboratoryObservations,
  laboratoryReport,
  observations,
  patient,
} from '@myfhir/synthetic';
import { weightTrend } from './weightTrend';

// The laboratory fixture explicitly declares this same demo source; no namespaces are merged.
export const recordsContext = laboratoryContext;

const store = createAcquisitionStore();
const issues: string[] = [];
for (const resource of [patient, ...observations, laboratoryReport, ...laboratoryObservations]) {
  const result = store.acquire({
    sourceNamespace: recordsContext.sourceNamespace,
    patientContext: recordsContext,
    resource,
  });
  if (result.status === 'rejected' || result.status === 'conflict') {
    issues.push(`${resource.id}: ${result.reason}`);
  }
}
// Explicit context assertion: never relabel resources from another declared source/patient.
if (
  imagingContext.sourceNamespace !== recordsContext.sourceNamespace ||
  imagingContext.patientId !== recordsContext.patientId
) {
  throw new Error('Synthetic imaging context must match the explicitly shared demo context.');
}
for (const resource of [imagingStudy, radiologyReport]) {
  const result = store.acquire({
    sourceNamespace: imagingContext.sourceNamespace,
    patientContext: imagingContext,
    resource,
  });
  if (result.status === 'rejected' || result.status === 'conflict') {
    issues.push(`${resource.id}: ${result.reason}`);
  }
}
export const recordsAcquisitionIssues = Object.freeze(issues);
export const recordsCatalog = buildClinicalCatalog(store.records(), recordsContext);

/** Inbound display links reuse resolved catalog evidence; this performs no new reference resolution. */
export function reportsForStudy(study: CatalogItem): readonly CatalogItem[] {
  if (study.resourceType !== 'ImagingStudy' || !recordsCatalog.items.includes(study)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    recordsCatalog.items.filter(
      (report) =>
        report.resourceType === 'DiagnosticReport' &&
        report.relationships.some(
          (relationship) =>
            relationship.kind === 'report-imaging-study' &&
            relationship.resolution === 'resolved' &&
            relationship.target === study.record,
        ),
    ),
  );
}

// Use exact engine references, including excluded records. Never reclassify numerical eligibility.
export const trendsCatalog = buildClinicalCatalog(
  [...weightTrend.series.points, ...weightTrend.series.exclusions].map((entry) => entry.record),
  weightTrend.series.patientContext,
  [weightTrend.series],
);

/** Legacy renderer accepts mutable R4 types but reads only. Keep the frozen snapshot itself. */
export function rendererNativeResource(item: CatalogItem): FhirResource {
  return item.resource as unknown as FhirResource;
}

export function catalogRecordParams(item: CatalogItem) {
  return {
    id: item.identity.logicalId,
    source: item.identity.sourceNamespace,
    type: item.resourceType,
    version: item.versionId,
  };
}

/** Exact local lookup in the fixed synthetic context; never a bare-ID or authorized query. */
export function findCatalogRecord(params: {
  id?: string | string[];
  source?: string | string[];
  type?: string | string[];
  version?: string | string[];
}) {
  if (
    typeof params.id !== 'string' ||
    typeof params.source !== 'string' ||
    typeof params.type !== 'string' ||
    (params.version !== undefined && typeof params.version !== 'string')
  ) {
    return undefined;
  }
  const matches = recordsCatalog.items.filter(
    (item) =>
      item.identity.logicalId === params.id &&
      item.identity.sourceNamespace === params.source &&
      item.resourceType === params.type &&
      item.versionId === params.version,
  );
  return matches.length === 1 ? matches[0] : undefined;
}
