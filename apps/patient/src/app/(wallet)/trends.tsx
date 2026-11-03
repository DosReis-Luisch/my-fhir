import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { patientName } from '@myfhir/fhir-core';
import { patient } from '@myfhir/synthetic';
import {
  selectTrendRange,
  trendRanges,
  trendRecordParams,
  weightTrend,
  type TrendRange,
} from '../../data/weightTrend';
import { Page } from '../../ui/Page';
import { WeightTrendChart } from '../../ui/WeightTrendChart';
import { trendsCatalog } from '../../data/clinicalCatalog';
import { colors } from '../../ui/theme';

export default function Trends() {
  const [range, setRange] = useState<TrendRange>('All');
  const { series, acquisitionIssues } = weightTrend;
  const selectedRange = selectTrendRange(series.points, range);
  const unit = series.measurement.unit.code;
  return (
    <Page inTabs>
      <Text accessibilityRole="header" style={styles.heading}>
        Trends
      </Text>
      <View style={styles.section}>
        <Text style={styles.description}>Synthetic patient · {patientName(patient.name)}</Text>
        <Text style={styles.description}>
          Fictional body-weight history, separate from the dashboard demo. These measurements do not
          describe a real person and provide no clinical interpretation.
        </Text>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {trendsCatalog.historySections[0]!.label}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          Body weight · {unit}
        </Text>
        <View style={styles.ranges}>
          {trendRanges.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={
                option === 'All'
                  ? 'All measurements'
                  : `Last ${option === '1Y' ? 'year' : option === '6M' ? 'six months' : 'month'}`
              }
              accessibilityState={{ selected: range === option }}
              onPress={() => setRange(option)}
              style={({ pressed }) => [
                styles.range,
                range === option && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.rangeText}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.description}>
          Ranges use UTC calendar months/year, ending at the most recent included measurement:{' '}
          {series.points.at(-1)?.effectiveDateTime ?? 'none'}. They do not use today’s date.
        </Text>
        <WeightTrendChart
          points={selectedRange.points}
          allPoints={series.points}
          start={selectedRange.start}
          end={selectedRange.end}
        />
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>
          Measurements · oldest first
        </Text>
        <Text style={styles.description}>
          {selectedRange.points.length} fictional measurements. Clinical timestamps below are
          exactly as supplied, including their timezone.
        </Text>
        {!selectedRange.points.length ? (
          <Text style={styles.description}>No measurements in this time range.</Text>
        ) : null}
        {selectedRange.points.map((point) => (
          <View key={JSON.stringify(trendRecordParams(point))} style={styles.measurement}>
            <Text selectable style={styles.value}>
              {point.value} {unit}
            </Text>
            <Text selectable style={styles.description}>
              {point.effectiveDateTime}
            </Text>
            <Link
              href={{ pathname: '/trend-record/[id]', params: trendRecordParams(point) }}
              style={styles.link}
              accessibilityLabel={`View original FHIR Observation for ${point.value} ${unit}, ${point.effectiveDateTime}`}
            >
              View original FHIR Observation →
            </Link>
          </View>
        ))}
      </View>
      {acquisitionIssues.length || series.exclusions.length ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.title}>
            Data preparation notices
          </Text>
          {acquisitionIssues.map((issue) => (
            <Text key={issue.index} style={styles.description}>
              Fixture {issue.index + 1}: {issue.reason}
            </Text>
          ))}
          {series.exclusions.map((entry, index) => (
            <Text key={index} style={styles.description}>
              {entry.record.metadata.identity.logicalId}: {entry.reason}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.title}>
          {trendsCatalog.historySections[1]!.label}
        </Text>
        <Text style={styles.description}>
          Planned for later: reports, imaging and conditions need reviewed timeline views. No
          additional history is available in this demo.
        </Text>
      </View>
      <Text selectable style={styles.description}>
        Fictional source: {series.patientContext.sourceNamespace}. Patient:{' '}
        {series.patientContext.patientId}. Context consistency is not authorization. This view does
        not validate clinical accuracy or infer normality, diagnoses or treatment.
      </Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  heading: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 23, flexShrink: 1 },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  range: {
    minWidth: 52,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.soft, borderColor: colors.accent },
  rangeText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  measurement: { borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 12, gap: 4 },
  value: { color: colors.ink, fontSize: 20, fontWeight: '500' },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    minHeight: 48,
    paddingVertical: 12,
  },
});
