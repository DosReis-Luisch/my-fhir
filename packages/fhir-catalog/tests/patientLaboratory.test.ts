import { describe, expect, it } from 'vitest';
import { presentResource } from '@myfhir/fhir-renderer';
import {
  laboratoryContext,
  laboratoryReport,
  laboratoryObservations,
  observations,
  resources,
  bundle,
  weightHistory,
} from '@myfhir/synthetic';
import {
  recordsCatalog,
  recordsContext,
  recordsAcquisitionIssues,
  catalogRecordParams,
  findCatalogRecord,
  rendererNativeResource,
  trendsCatalog,
} from '../../../apps/patient/src/data/clinicalCatalog';
import { selectTrendRange, weightTrend } from '../../../apps/patient/src/data/weightTrend';

describe('synthetic laboratory Records integration', () => {
  it('lists one report and two independent results with exact original-record navigation', () => {
    expect(recordsAcquisitionIssues).toEqual([]);
    expect(recordsContext).toEqual(laboratoryContext);
    const reports = recordsCatalog.groups.find((group) => group.category === 'laboratory-report')!;
    const results = recordsCatalog.groups.find((group) => group.category === 'laboratory')!;
    expect(reports.label).toBe('Laboratory reports');
    expect(reports.items).toHaveLength(1);
    expect(results.label).toBe('Laboratory results');
    expect(results.items).toHaveLength(2);
    const report = reports.items[0]!;
    expect(report.resource).toEqual(laboratoryReport);
    expect(findCatalogRecord(catalogRecordParams(report))).toBe(report);
    expect(presentResource(rendererNativeResource(report)).kind).toBe('diagnostic-report');
    for (const relationship of report.relationships) {
      expect(relationship.resolution).toBe('resolved');
      if (relationship.resolution !== 'resolved') throw new Error('Expected fixture result');
      const item = results.items.find((entry) => entry.record === relationship.target)!;
      expect(item.resource).toEqual(
        laboratoryObservations.find((resource) => resource.id === item.identity.logicalId),
      );
      expect(presentResource(rendererNativeResource(item)).kind).toBe('observation');
      expect(
        presentResource(rendererNativeResource(item)).fields.some(
          (field) => field.sourcePath === 'valueQuantity',
        ),
      ).toBe(true);
      expect(findCatalogRecord(catalogRecordParams(item))).toBe(item);
      expect(
        findCatalogRecord({ ...catalogRecordParams(item), source: 'synthetic:foreign-lab' }),
      ).toBeUndefined();
      expect(
        findCatalogRecord({ ...catalogRecordParams(item), type: 'DiagnosticReport' }),
      ).toBeUndefined();
      expect(findCatalogRecord({ ...catalogRecordParams(item), version: '2' })).toBeUndefined();
      expect(findCatalogRecord({ id: item.identity.logicalId })).toBeUndefined();
      expect(
        findCatalogRecord({ ...catalogRecordParams(item), version: ['1', '2'] }),
      ).toBeUndefined();
    }
  });

  it('does not add laboratory records to dashboard, Bundle or the weight series', () => {
    expect(observations).toHaveLength(3);
    expect(observations[0]?.component?.map((component) => component.valueQuantity?.value)).toEqual([
      118, 76,
    ]);
    expect(observations[1]?.valueQuantity?.value).toBe(68);
    expect(observations[2]?.valueQuantity?.value).toBe(72.4);
    expect(resources).toHaveLength(5);
    expect(bundle.entry).toHaveLength(5);
    for (const laboratory of [laboratoryReport, ...laboratoryObservations]) {
      expect(resources.some((resource) => resource.id === laboratory.id)).toBe(false);
      expect(bundle.entry?.some((entry) => entry.resource?.id === laboratory.id)).toBe(false);
      expect(weightHistory.some((resource) => resource.id === laboratory.id)).toBe(false);
      expect(
        weightTrend.series.points.some(
          (point) => point.record.metadata.identity.logicalId === laboratory.id,
        ),
      ).toBe(false);
    }
    expect(weightTrend.series.points).toHaveLength(10);
    expect(selectTrendRange(weightTrend.series.points, '1M').points).toHaveLength(1);
    expect(selectTrendRange(weightTrend.series.points, '6M').points).toHaveLength(7);
    expect(selectTrendRange(weightTrend.series.points, '1Y').points).toHaveLength(10);
    expect(selectTrendRange(weightTrend.series.points, 'All').points).toHaveLength(10);
    expect(trendsCatalog.historySections[0]?.items).toHaveLength(10);
    expect(recordsCatalog.historySections[0]?.status).toBe('unavailable');
    expect(
      recordsCatalog.items.every((item) => !item.capabilities.includes('numerical-history')),
    ).toBe(true);
  });
});
