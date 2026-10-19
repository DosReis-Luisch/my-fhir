import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { resourceReference } from '@myfhir/fhir-core';
import { presentResource } from '@myfhir/fhir-renderer';
import { patient } from '@myfhir/synthetic';
import { demoPatientObservations } from '../../data/demoRecords';
import { Page } from '../../ui/Page';
import { ResourceCard } from '../../ui/ResourceCard';
import { colors } from '../../ui/theme';

export default function Home() {
  const patientPresentation = presentResource(patient);
  // A small selection in demo order, not a selection by clinical recency.
  const measurementSnapshot = demoPatientObservations.slice(0, 2);

  return (
    <Page inTabs>
      <View style={styles.section}>
        <Text style={styles.eyebrow}>YOUR PERSONAL HEALTH WALLET</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          Home
        </Text>
        <Text style={styles.description}>
          Your fictional patient information and recorded measurements, together in one place.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.description}>Synthetic patient context</Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {patientPresentation.title}
        </Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Recorded measurements
        </Text>
        <Text style={styles.description}>
          A short selection of demo measurements, shown as recorded. See Records for all available
          observations. This demo does not assess normality or infer clinical trends.
        </Text>
      </View>
      <View style={styles.grid}>
        {measurementSnapshot.map((resource) => (
          <View style={styles.gridItem} key={resourceReference(resource)}>
            <ResourceCard presentation={presentResource(resource)} compact />
          </View>
        ))}
      </View>
      {!measurementSnapshot.length ? (
        <Text style={styles.description}>No synthetic measurements are available.</Text>
      ) : null}
      <Link href="/records" style={styles.link}>
        Browse patient records →
      </Link>
      <View style={styles.demo}>
        <Text style={styles.description}>Developer / synthetic demo</Text>
        <Link href="/profile-inspection" style={styles.link}>
          Explore FHIR profile inspection (demo)
        </Link>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heading: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 23 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  link: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 12,
    minHeight: 48,
  },
  demo: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 20, gap: 4 },
});
