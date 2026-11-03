import { describe, expect, it } from 'vitest';
import { createAcquisitionStore } from '@myfhir/fhir-acquisition';
import {
  bundle,
  observations,
  patient,
  resources,
  weightHistory,
  weightHistoryContext,
} from '@myfhir/synthetic';
import { analyzeQuantitySeries } from '../src/index';
// Application adapter integration tests stay in the established packages/*/tests Node suite.
// These imports are pure data/presentation helpers: no React, SVG or Expo is loaded.
import {
  findTrendPoint,
  prepareWeightTrend,
  selectTrendRange,
  trendRecordParams,
} from '../../../apps/patient/src/data/weightTrend';
import { trendChartGeometry } from '../../../apps/patient/src/data/trendChart';

function fixture(id: string, effectiveDateTime: string) {
  return { ...weightHistory[0]!, id, effectiveDateTime };
}

describe('patient Trends data preparation', () => {
  it('derives ten fictional measurements from acquisition and longitudinal engines', () => {
    const prepared = prepareWeightTrend();
    const store = createAcquisitionStore();
    weightHistory.forEach((resource) =>
      store.acquire({
        sourceNamespace: weightHistoryContext.sourceNamespace,
        patientContext: weightHistoryContext,
        resource,
      }),
    );
    const expected = analyzeQuantitySeries(store.records(), {
      patientContext: weightHistoryContext,
      measurement: {
        coding: { system: 'http://loinc.org', code: '29463-7' },
        unit: { system: 'http://unitsofmeasure.org', code: 'kg' },
      },
    });
    expect(prepared.series).toEqual(expected);
    expect(prepared.acquisitionIssues).toEqual([]);
    expect(prepared.series.exclusions).toEqual([]);
    expect(prepared.series.points).toHaveLength(10);
    expect(
      new Set(prepared.series.points.map((point) => point.record.metadata.identity.logicalId)).size,
    ).toBe(10);
    expect(weightHistoryContext.patientId).toBe(patient.id);
    expect(prepared.series.patientContext).toEqual(weightHistoryContext);
    expect(prepared.series.authorization).toBe('not-checked');
    prepared.series.points.forEach((point) => {
      expect(point.record.metadata.identity.sourceNamespace).toBe(
        weightHistoryContext.sourceNamespace,
      );
      expect(point.record.resource).toEqual(
        weightHistory.find((resource) => resource.id === point.record.metadata.identity.logicalId),
      );
    });
  });

  it('keeps the three original dashboard measurements and demo Bundle separate', () => {
    const originalIds = resources.map((resource) => resource.id);
    expect(observations).toHaveLength(3);
    expect(observations[1]?.valueQuantity?.value).toBe(68);
    expect(observations[2]?.valueQuantity?.value).toBe(72.4);
    expect(observations[0]?.component?.map((component) => component.valueQuantity?.value)).toEqual([
      118, 76,
    ]);
    weightHistory.forEach((resource) => {
      expect(originalIds).not.toContain(resource.id);
      expect(bundle.entry?.some((entry) => entry.resource?.id === resource.id)).toBe(false);
    });
  });

  it('preserves original fixtures and engine point references while changing ranges', () => {
    const before = JSON.stringify(weightHistory);
    const { series } = prepareWeightTrend();
    const all = selectTrendRange(series.points, 'All');
    const month = selectTrendRange(series.points, '1M');
    expect(month.points).toHaveLength(1);
    expect(month.points[0]).toBe(series.points.at(-1));
    expect(selectTrendRange(series.points, '6M').points).toHaveLength(7);
    expect(selectTrendRange(series.points, '1Y').points).toHaveLength(10);
    expect(all.points).toEqual(series.points);
    expect(JSON.stringify(weightHistory)).toBe(before);
    expect(Object.isFrozen(month.points)).toBe(true);
    expect(series.points.at(-1)?.value).toBe(72.4);
  });

  it('uses exact clinical instants and inclusive calendar cutoffs anchored to the latest point', () => {
    const { series } = prepareWeightTrend([
      fixture('latest', '2026-10-28T08:00:00Z'),
      fixture('before', '2026-09-28T08:59:59+01:00'),
      fixture('boundary', '2026-09-28T09:00:00+01:00'),
    ]);
    const range = selectTrendRange(series.points, '1M');
    expect(range.end).toBe(Date.parse('2026-10-28T08:00:00Z'));
    expect(range.start).toBe(Date.parse('2026-09-28T08:00:00Z'));
    expect(range.points.map((point) => point.record.metadata.identity.logicalId)).toEqual([
      'boundary',
      'latest',
    ]);
  });

  it('clamps a calendar-month cutoff at the end of February without inventing dates', () => {
    const { series } = prepareWeightTrend([
      fixture('before', '2026-02-27T08:00:00Z'),
      fixture('boundary', '2026-02-28T08:00:00Z'),
      fixture('latest', '2026-03-31T08:00:00Z'),
    ]);
    const range = selectTrendRange(series.points, '1M');
    expect(range.start).toBe(Date.parse('2026-02-28T08:00:00Z'));
    expect(range.points).toHaveLength(2);
  });

  it('returns honest empty ranges when no eligible measurements exist', () => {
    const { series } = prepareWeightTrend([]);
    for (const range of ['1M', '6M', '1Y', 'All'] as const) {
      expect(selectTrendRange(series.points, range)).toEqual({
        points: [],
        start: undefined,
        end: undefined,
      });
    }
  });

  it('reports acquisition and engine exclusions rather than duplicating their clinical rules', () => {
    const wrongPatient = { ...weightHistory[0], subject: { reference: 'Patient/another-person' } };
    const wrongUnit = {
      ...weightHistory[1],
      valueQuantity: { value: 160, system: 'http://unitsofmeasure.org', code: '[lb_av]' },
    };
    const prepared = prepareWeightTrend([wrongPatient, wrongUnit]);
    expect(prepared.acquisitionIssues[0]?.reason).toBe('patient-context-mismatch');
    expect(prepared.series.exclusions[0]?.reason).toBe('unit-mismatch');
    expect(prepared.series.points).toHaveLength(0);
  });

  it('looks up original acquired records using source, type, logical ID and version', () => {
    const { series } = prepareWeightTrend();
    const point = series.points[0]!;
    const params = trendRecordParams(point);
    expect(findTrendPoint(params, series.points)).toBe(point);
    expect(findTrendPoint({ id: params.id }, series.points)).toBeUndefined();
    expect(
      findTrendPoint({ ...params, source: 'urn:another:source' }, series.points),
    ).toBeUndefined();
    expect(findTrendPoint({ ...params, type: 'Patient' }, series.points)).toBeUndefined();
    expect(findTrendPoint({ ...params, version: '2' }, series.points)).toBeUndefined();
    expect(findTrendPoint({ ...params, id: [params.id] }, series.points)).toBeUndefined();
    expect(findTrendPoint({ ...params, source: [params.source] }, series.points)).toBeUndefined();
  });

  it('does not collapse differently qualified records with matching bare logical IDs', () => {
    const { series } = prepareWeightTrend();
    const point = series.points[0]!;
    const foreignContext = { ...weightHistoryContext, sourceNamespace: 'urn:another:source' };
    const store = createAcquisitionStore();
    store.acquire({
      sourceNamespace: foreignContext.sourceNamespace,
      patientContext: foreignContext,
      resource: weightHistory[0],
    });
    const foreign = analyzeQuantitySeries(store.records(), {
      patientContext: foreignContext,
      measurement: series.measurement,
    }).points[0]!;
    expect(findTrendPoint(trendRecordParams(point), [foreign, point])).toBe(point);
    expect(findTrendPoint(trendRecordParams(foreign), [foreign, point])).toBeUndefined();
  });

  it('plots real unequal intervals with stable zero-based scaling and no invented points', () => {
    const { series } = prepareWeightTrend([
      fixture('one', '2026-01-01T08:00:00Z'),
      fixture('two', '2026-01-02T08:00:00Z'),
      fixture('three', '2026-01-11T08:00:00Z'),
    ]);
    const range = selectTrendRange(series.points, 'All');
    const chart = trendChartGeometry(range.points, series.points, range.start!, range.end!, 300);
    expect(chart.dots).toHaveLength(3);
    expect(
      (chart.dots[1]!.x - chart.dots[0]!.x) / (chart.dots[2]!.x - chart.dots[1]!.x),
    ).toBeCloseTo(1 / 9);
    expect(chart.dots[0]?.point).toBe(series.points[0]);
    expect(chart.maximum).toBe(100);
    expect(
      trendChartGeometry([series.points[2]!], series.points, range.end!, range.end!, 220).maximum,
    ).toBe(chart.maximum);
    expect(chart.dots.every((dot) => Number.isFinite(dot.x) && Number.isFinite(dot.y))).toBe(true);
  });
});
