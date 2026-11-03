import { createAcquisitionStore } from '@myfhir/fhir-acquisition';
import { analyzeQuantitySeries, type MeasurementPoint } from '@myfhir/fhir-longitudinal';
import { weightHistory, weightHistoryContext } from '@myfhir/synthetic';

export function prepareWeightTrend(resources: readonly unknown[] = weightHistory) {
  const store = createAcquisitionStore();
  const acquisitionIssues: { index: number; reason: string }[] = [];
  resources.forEach((resource, index) => {
    const result = store.acquire({
      sourceNamespace: weightHistoryContext.sourceNamespace,
      patientContext: weightHistoryContext,
      resource,
    });
    if (result.status === 'rejected' || result.status === 'conflict') {
      acquisitionIssues.push(Object.freeze({ index, reason: result.reason }));
    }
  });
  const series = analyzeQuantitySeries(store.records(), {
    patientContext: weightHistoryContext,
    measurement: {
      coding: { system: 'http://loinc.org', code: '29463-7' },
      unit: { system: 'http://unitsofmeasure.org', code: 'kg' },
    },
  });
  return Object.freeze({ series, acquisitionIssues: Object.freeze(acquisitionIssues) });
}

export const weightTrend = prepareWeightTrend();
export const trendRanges = ['1M', '6M', '1Y', 'All'] as const;
export type TrendRange = (typeof trendRanges)[number];

/** Presentation-only time window over engine-selected points; never clinical selection. */
export function selectTrendRange(points: readonly MeasurementPoint[], range: TrendRange) {
  const reference = points.at(-1)?.effectiveDateTime;
  if (!reference) {
    return Object.freeze({
      points: Object.freeze([]) as readonly MeasurementPoint[],
      start: undefined,
      end: undefined,
    });
  }
  const end = Date.parse(reference);
  let start = Date.parse(points[0]!.effectiveDateTime);
  if (range !== 'All') {
    const cutoff = new Date(end);
    const day = cutoff.getUTCDate();
    cutoff.setUTCDate(1);
    const months = { '1M': 1, '6M': 6, '1Y': 12 }[range];
    cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
    const monthEnd = new Date(cutoff.getTime());
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    cutoff.setUTCDate(Math.min(day, monthEnd.getUTCDate()));
    start = cutoff.getTime();
  }
  return Object.freeze({
    points: Object.freeze(
      points.filter((point) => {
        const time = Date.parse(point.effectiveDateTime);
        return time >= start && time <= end;
      }),
    ),
    start,
    end,
  });
}

export function trendRecordParams(point: MeasurementPoint) {
  const { sourceNamespace, resourceType, logicalId } = point.record.metadata.identity;
  return {
    id: logicalId,
    source: sourceNamespace,
    type: resourceType,
    version: point.record.metadata.versionId,
  };
}

/** Exact local synthetic lookup; no bare-ID fallback or arbitrary URL/source resolution. */
export function findTrendPoint(
  params: {
    id?: string | string[];
    source?: string | string[];
    type?: string | string[];
    version?: string | string[];
  },
  points: readonly MeasurementPoint[] = weightTrend.series.points,
): MeasurementPoint | undefined {
  if (
    typeof params.id !== 'string' ||
    typeof params.source !== 'string' ||
    params.type !== 'Observation' ||
    (params.version !== undefined && typeof params.version !== 'string')
  )
    return undefined;
  return points.find((point) => {
    const { identity, versionId, patientContext } = point.record.metadata;
    return (
      identity.sourceNamespace === params.source &&
      identity.resourceType === params.type &&
      identity.logicalId === params.id &&
      versionId === params.version &&
      patientContext.sourceNamespace === weightHistoryContext.sourceNamespace &&
      patientContext.patientId === weightHistoryContext.patientId
    );
  });
}
