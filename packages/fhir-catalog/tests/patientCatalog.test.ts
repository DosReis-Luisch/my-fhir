import { describe, expect, it } from 'vitest';
import { presentResource } from '@myfhir/fhir-renderer';
import { observations, resources, bundle, weightHistory } from '@myfhir/synthetic';
import { buildClinicalCatalog } from '../src/index';
import {
  catalogRecordParams,
  findCatalogRecord,
  recordsCatalog,
  recordsContext,
  recordsAcquisitionIssues,
  rendererNativeResource,
  trendsCatalog,
} from '../../../apps/patient/src/data/clinicalCatalog';
import {
  prepareWeightTrend,
  selectTrendRange,
  weightTrend,
} from '../../../apps/patient/src/data/weightTrend';

describe('shared patient catalog adapters', () => {
  it('uses the shared classifier for Records and preserves existing renderer output', () => {
    expect(recordsAcquisitionIssues).toEqual([]);
    expect(recordsCatalog.groups).toEqual(
      buildClinicalCatalog(
        recordsCatalog.items.map((item) => item.record),
        recordsContext,
      ).groups,
    );
    expect(recordsCatalog.groups.map((group) => [group.category, group.items.length])).toEqual([
      ['vital-signs', 3],
      ['laboratory-report', 1],
      ['laboratory', 2],
    ]);
    for (const item of recordsCatalog.groups[0]!.items) {
      const original = observations.find((resource) => resource.id === item.identity.logicalId)!;
      expect(presentResource(rendererNativeResource(item))).toEqual(presentResource(original));
      expect(findCatalogRecord(catalogRecordParams(item))).toBe(item);
      expect(findCatalogRecord({ id: item.identity.logicalId })).toBeUndefined();
      expect(findCatalogRecord({ ...catalogRecordParams(item), source: 'other' })).toBeUndefined();
      expect(findCatalogRecord({ ...catalogRecordParams(item), type: 'Patient' })).toBeUndefined();
      expect(
        findCatalogRecord({ ...catalogRecordParams(item), version: 'missing' }),
      ).toBeUndefined();
      expect(
        findCatalogRecord({
          ...catalogRecordParams(item),
          source: [item.identity.sourceNamespace],
        }),
      ).toBeUndefined();
    }
  });

  it('uses the same catalog for Trends without changing engine series, ranges or original fixtures', () => {
    const before = JSON.stringify({ observations, resources, bundle, weightHistory });
    const expected = prepareWeightTrend();
    expect(weightTrend.series).toEqual(expected.series);
    expect(weightTrend.series.points).toHaveLength(10);
    const historical = trendsCatalog.historySections[0]!.items;
    expect(historical).toHaveLength(10);
    expect(trendsCatalog.groups[0]?.category).toBe('unclassified');
    for (const point of weightTrend.series.points) {
      expect(historical.find((item) => item.record === point.record)?.resource).toBe(
        point.record.resource,
      );
    }
    expect(selectTrendRange(weightTrend.series.points, '1M').points).toHaveLength(1);
    expect(selectTrendRange(weightTrend.series.points, '6M').points).toHaveLength(7);
    expect(selectTrendRange(weightTrend.series.points, '1Y').points).toHaveLength(10);
    expect(
      recordsCatalog.items.some((item) => historical.some((history) => history.key === item.key)),
    ).toBe(false);
    expect(JSON.stringify({ observations, resources, bundle, weightHistory })).toBe(before);
    expect(observations[1]?.valueQuantity?.value).toBe(68);
    expect(observations[2]?.valueQuantity?.value).toBe(72.4);
    expect(bundle.entry?.some((entry) => entry.resource?.id === weightHistory[0]?.id)).toBe(false);
  });
});
