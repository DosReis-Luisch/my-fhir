import type { MeasurementPoint } from '@myfhir/fhir-longitudinal';

/** Pure screen geometry. No grouping, unit conversion, clinical selection or new measurements. */
export function trendChartGeometry(
  points: readonly MeasurementPoint[],
  allPoints: readonly MeasurementPoint[],
  start: number,
  end: number,
  width: number,
) {
  const left = 48;
  const right = Math.max(left + 1, width - 16);
  const top = 18;
  const bottom = 194;
  // Zero-based and stable across ranges. No auto-zoom into tiny weight changes.
  const maximum = Math.max(
    100,
    Math.ceil(Math.max(0, ...allPoints.map((point) => point.value)) / 20) * 20,
  );
  const domainStart = start === end ? start - 86400000 : start;
  const domainEnd = start === end ? end + 86400000 : end;
  return {
    left,
    right,
    top,
    bottom,
    maximum,
    domainStart,
    domainEnd,
    dots: points.map((point) => ({
      point,
      x:
        left +
        ((Date.parse(point.effectiveDateTime) - domainStart) / (domainEnd - domainStart)) *
          (right - left),
      y: bottom - (point.value / maximum) * (bottom - top),
    })),
  };
}
