import { describe, expect, it } from 'vitest';
import { presentResource } from '@myfhir/fhir-renderer';
import {
  imagingContext,
  imagingStudy,
  radiologyReport,
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
  findCatalogRecord,
  catalogRecordParams,
  rendererNativeResource,
  reportsForStudy,
  trendsCatalog,
} from '../../../apps/patient/src/data/clinicalCatalog';
import { weightTrend, selectTrendRange } from '../../../apps/patient/src/data/weightTrend';

describe('synthetic imaging Records flow', () => {
  it('lists independent study/report records and reuses resolved evidence for both navigation directions', () => {
    expect(recordsAcquisitionIssues).toEqual([]);
    expect(recordsContext).toEqual(imagingContext);
    expect(recordsCatalog.groups.map((group) => [group.category, group.items.length])).toEqual([
      ['vital-signs', 3],
      ['laboratory-report', 1],
      ['laboratory', 2],
      ['radiology-report', 1],
      ['imaging-study', 1],
    ]);
    const report = recordsCatalog.items.find(
      (item) => item.identity.logicalId === radiologyReport.id,
    )!;
    const study = recordsCatalog.items.find((item) => item.identity.logicalId === imagingStudy.id)!;
    expect(report.resource).toEqual(radiologyReport);
    expect(study.resource).toEqual(imagingStudy);
    expect(report.relationships[0]).toMatchObject({
      kind: 'report-imaging-study',
      resolution: 'resolved',
      target: study.record,
    });
    expect(reportsForStudy(study)).toEqual([report]);
    expect(Object.isFrozen(reportsForStudy(study))).toBe(true);
    expect(reportsForStudy(report)).toEqual([]);
    expect(presentResource(rendererNativeResource(report)).kind).toBe('diagnostic-report');
    expect(presentResource(rendererNativeResource(study)).kind).toBe('imaging-study');
    for (const item of [study, report]) {
      const params = catalogRecordParams(item);
      expect(findCatalogRecord(params)).toBe(item);
      expect(findCatalogRecord({ id: params.id })).toBeUndefined();
      expect(findCatalogRecord({ ...params, source: 'synthetic:foreign' })).toBeUndefined();
      expect(findCatalogRecord({ ...params, type: 'Observation' })).toBeUndefined();
      expect(findCatalogRecord({ ...params, version: '2' })).toBeUndefined();
      expect(findCatalogRecord({ ...params, source: [params.source] })).toBeUndefined();
      expect(findCatalogRecord({ ...params, version: ['1', '2'] })).toBeUndefined();
    }
  });

  it('preserves original Bundle/dashboard/laboratory and weight-history boundaries', () => {
    expect(observations).toHaveLength(3);
    expect(observations[0]?.component?.map((component) => component.valueQuantity?.value)).toEqual([
      118, 76,
    ]);
    expect(observations[1]?.valueQuantity?.value).toBe(68);
    expect(observations[2]?.valueQuantity?.value).toBe(72.4);
    expect(resources).toHaveLength(5);
    expect(bundle.entry).toHaveLength(5);
    const lab = recordsCatalog.items.find(
      (item) => item.identity.logicalId === laboratoryReport.id,
    )!;
    expect(lab.resource).toEqual(laboratoryReport);
    expect(lab.relationships).toHaveLength(2);
    for (const link of lab.relationships) {
      expect(link).toMatchObject({ kind: 'report-result', resolution: 'resolved' });
      if (link.resolution === 'resolved')
        expect(laboratoryObservations).toContainEqual(link.target.resource);
    }
    for (const added of [imagingStudy, radiologyReport]) {
      expect(resources.some((resource) => resource.id === added.id)).toBe(false);
      expect(bundle.entry?.some((entry) => entry.resource?.id === added.id)).toBe(false);
      expect(weightHistory.some((resource) => resource.id === added.id)).toBe(false);
    }
    expect(weightTrend.series.points).toHaveLength(10);
    expect(
      ['1M', '6M', '1Y', 'All'].map(
        (range) =>
          selectTrendRange(weightTrend.series.points, range as '1M' | '6M' | '1Y' | 'All').points
            .length,
      ),
    ).toEqual([1, 7, 10, 10]);
    expect(trendsCatalog.historySections[0]?.items).toHaveLength(10);
    expect(
      recordsCatalog.items.every((item) => !item.capabilities.includes('numerical-history')),
    ).toBe(true);
  });
});
