import { describe, expect, it } from 'vitest';
import { presentResource } from '@myfhir/fhir-renderer';
import {
  conditions,
  conditionsContext,
  observations,
  resources,
  bundle,
  weightHistory,
  laboratoryReport,
  laboratoryObservations,
  imagingStudy,
  radiologyReport,
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
import { weightTrend, selectTrendRange } from '../../../apps/patient/src/data/weightTrend';

describe('recorded Condition application integration', () => {
  it('shows separate problem-list/encounter assertions with exact original-resource navigation', () => {
    expect(recordsAcquisitionIssues).toEqual([]);
    expect(recordsContext).toEqual(conditionsContext);
    expect(recordsCatalog.groups.map((group) => [group.category, group.items.length])).toEqual([
      ['vital-signs', 3],
      ['laboratory-report', 1],
      ['laboratory', 2],
      ['radiology-report', 1],
      ['imaging-study', 1],
      ['problem-list-item', 1],
      ['encounter-diagnosis', 1],
    ]);
    for (const resource of conditions) {
      const item = recordsCatalog.items.find((entry) => entry.identity.logicalId === resource.id)!;
      const params = catalogRecordParams(item);
      expect(item.resource).toEqual(resource);
      expect(presentResource(rendererNativeResource(item)).kind).toBe('condition');
      expect(findCatalogRecord(params)).toBe(item);
      expect(findCatalogRecord({ ...params, source: 'foreign' })).toBeUndefined();
      expect(findCatalogRecord({ ...params, type: 'Observation' })).toBeUndefined();
      expect(findCatalogRecord({ ...params, version: '2' })).toBeUndefined();
      expect(findCatalogRecord({ id: params.id })).toBeUndefined();
      expect(findCatalogRecord({ ...params, source: [params.source] })).toBeUndefined();
      expect(findCatalogRecord({ ...params, type: ['Condition'] })).toBeUndefined();
      expect(findCatalogRecord({ ...params, id: [params.id] })).toBeUndefined();
      expect(findCatalogRecord({ ...params, version: ['1', '2'] })).toBeUndefined();
    }
    const encounter = recordsCatalog.items.find((item) => item.category === 'encounter-diagnosis')!;
    expect(encounter.relationships.find((entry) => entry.path === 'encounter')).toMatchObject({
      resolution: 'unresolved',
      reason: 'resolution-not-implemented',
    });
    expect(recordsCatalog.items.some((item) => String(item.resourceType) === 'Encounter')).toBe(
      false,
    );
  });

  it('preserves the prior laboratory/imaging resources and resolved relationships', () => {
    for (const report of [laboratoryReport, radiologyReport]) {
      const item = recordsCatalog.items.find((entry) => entry.identity.logicalId === report.id)!;
      expect(item.resource).toEqual(report);
      expect(item.relationships.every((entry) => entry.resolution === 'resolved')).toBe(true);
      for (const link of item.relationships) {
        if (link.resolution !== 'resolved') throw new Error('Expected prior local target');
        expect([...laboratoryObservations, imagingStudy]).toContainEqual(link.target.resource);
        const target = recordsCatalog.items.find((entry) => entry.record === link.target)!;
        expect(findCatalogRecord(catalogRecordParams(target))).toBe(target);
      }
    }
    expect(recordsCatalog.items.filter((item) => item.resourceType === 'Condition')).toHaveLength(
      2,
    );
    expect(observations[0]?.component?.map((component) => component.valueQuantity?.value)).toEqual([
      118, 76,
    ]);
    expect(observations[1]?.valueQuantity?.value).toBe(68);
    expect(observations[2]?.valueQuantity?.value).toBe(72.4);
    expect(resources).toHaveLength(5);
    expect(bundle.entry).toHaveLength(5);
    for (const resource of conditions) {
      expect(resources.some((entry) => entry.id === resource.id)).toBe(false);
      expect(bundle.entry?.some((entry) => entry.resource?.id === resource.id)).toBe(false);
      expect(weightHistory.some((entry) => entry.id === resource.id)).toBe(false);
    }
    expect(weightTrend.series.points).toHaveLength(10);
    expect(
      (['1M', '6M', '1Y', 'All'] as const).map(
        (range) => selectTrendRange(weightTrend.series.points, range).points.length,
      ),
    ).toEqual([1, 7, 10, 10]);
    expect(trendsCatalog.historySections[0]?.items).toHaveLength(10);
    expect(
      recordsCatalog.items.every((item) => !item.capabilities.includes('numerical-history')),
    ).toBe(true);
  });
});
