import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { findTrendPoint } from '../../data/weightTrend';
import { BackToWallet } from '../../ui/BackToWallet';
import { Page } from '../../ui/Page';
import { colors } from '../../ui/theme';

export default function TrendRecordDetails() {
  const params = useLocalSearchParams<{
    id: string | string[];
    source: string | string[];
    type: string | string[];
    version: string | string[];
  }>();
  const point = findTrendPoint(params);
  const [showSource, setShowSource] = useState(false);
  return (
    <Page>
      <BackToWallet fallback="/trends" />
      <Text accessibilityRole="header" style={styles.heading}>
        Original trend Observation
      </Text>
      {point ? (
        <View style={styles.section}>
          <Text style={styles.description}>
            Fictional body weight · synthetic patient Alex Morgan.
          </Text>
          <Text selectable style={styles.value}>
            {point.value} kg
          </Text>
          <Text selectable style={styles.description}>
            Clinically effective time: {point.effectiveDateTime}
          </Text>
          <Text selectable style={styles.description}>
            Source: {point.record.metadata.identity.sourceNamespace}
          </Text>
          <Text selectable style={styles.description}>
            {point.record.metadata.identity.resourceType}/{point.record.metadata.identity.logicalId}
          </Text>
          <Text selectable style={styles.description}>
            Version: {point.record.metadata.versionId ?? 'not supplied'}
          </Text>
          <Text selectable style={styles.description}>
            Patient context: {point.record.metadata.patientContext.patientId}
          </Text>
          <Text style={styles.description}>
            Hand-authored synthetic source only. No real provider provenance, verified identity,
            clinical validation or medical interpretation is implied.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showSource }}
            onPress={() => setShowSource((value) => !value)}
            style={styles.button}
          >
            <Text style={styles.link}>
              {showSource ? 'Hide original FHIR record' : 'View original FHIR record'}
            </Text>
          </Pressable>
          {showSource ? (
            <Text selectable style={styles.code}>
              {JSON.stringify(point.record.resource, null, 2)}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.description}>
          This source-qualified record was not found in the fictional weight history.
        </Text>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { color: colors.ink, fontSize: 25, fontWeight: '600' },
  value: { color: colors.ink, fontSize: 23, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 23, flexShrink: 1 },
  button: {
    alignSelf: 'flex-start',
    padding: 12,
    minHeight: 48,
    backgroundColor: colors.soft,
    borderRadius: 8,
  },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  code: {
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
