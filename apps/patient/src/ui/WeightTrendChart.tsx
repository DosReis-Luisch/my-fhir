import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { MeasurementPoint } from '@myfhir/fhir-longitudinal';
import { trendChartGeometry } from '../data/trendChart';
import { colors } from './theme';

export function WeightTrendChart({
  points,
  allPoints,
  start,
  end,
}: {
  points: readonly MeasurementPoint[];
  allPoints: readonly MeasurementPoint[];
  start: number | undefined;
  end: number | undefined;
}) {
  const [width, setWidth] = useState(300);
  if (!points.length || start === undefined || end === undefined) {
    return <Text style={styles.caption}>No measurements in this time range.</Text>;
  }
  const chart = trendChartGeometry(points, allPoints, start, end, width);
  return (
    <View
      style={styles.container}
      onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
    >
      <Text style={styles.caption}>Body weight (kg) · zero-based scale</Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Body weight chart in kilograms, ${points.length} fictional measurements. Full dates and values follow in the chronological list.`}
      >
        <Svg width="100%" height={240} viewBox={`0 0 ${width} 240`}>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = chart.bottom - fraction * (chart.bottom - chart.top);
            return (
              <G key={fraction}>
                <Line x1={chart.left} x2={chart.right} y1={y} y2={y} stroke={colors.border} />
                <SvgText
                  x={chart.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={12}
                  fill={colors.muted}
                >
                  {fraction * chart.maximum}
                </SvgText>
              </G>
            );
          })}
          <Line
            x1={chart.left}
            x2={chart.left}
            y1={chart.top}
            y2={chart.bottom}
            stroke={colors.muted}
          />
          {chart.dots.length > 1 ? (
            <Polyline
              points={chart.dots.map(({ x, y }) => `${x},${y}`).join(' ')}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2}
            />
          ) : null}
          {chart.dots.map(({ point, x, y }) => (
            <Circle
              key={JSON.stringify([
                point.record.metadata.identity,
                point.record.metadata.versionId,
              ])}
              cx={x}
              cy={y}
              r={4}
              fill={colors.accent}
            />
          ))}
          <SvgText x={chart.left} y={218} fontSize={11} fill={colors.muted}>
            {new Date(chart.domainStart).toISOString().slice(0, 10)}
          </SvgText>
          <SvgText x={chart.right} y={218} textAnchor="end" fontSize={11} fill={colors.muted}>
            {new Date(chart.domainEnd).toISOString().slice(0, 10)}
          </SvgText>
        </Svg>
      </View>
      <Text style={styles.caption}>
        Clinical time · UTC axis. Dots are supplied measurements. Lines only connect them; no
        measurements are estimated between dots.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 8 },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 21 },
});
