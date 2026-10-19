import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { isResource, resourceReference } from '@myfhir/fhir-core';
import { presentResource } from '@myfhir/fhir-renderer';
import { organization, patient, resources } from '@myfhir/synthetic';
import { Page } from '../ui/Page';
import { ResourceCard } from '../ui/ResourceCard';
import { colors } from '../ui/theme';

export default function Overview() {
  const patientReference = resourceReference(patient);
  const observations = resources.filter(
    (resource) =>
      isResource(resource, 'Observation') && resource.subject?.reference === patientReference,
  );
  return (
    <Page>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>YOUR HEALTH AT A GLANCE</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          A clearer picture of you.
        </Text>
        <Text style={styles.description}>
          One place for your health information, with the details always within reach.
        </Text>
      </View>
      <ResourceCard presentation={presentResource(patient)} compact />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Recorded measurements
        </Text>
        <Text style={styles.description}>A snapshot from a fictional visit on 1 October 2026.</Text>
      </View>
      <View style={styles.grid}>
        {observations.map((resource) => (
          <View style={styles.gridItem} key={resourceReference(resource)}>
            <ResourceCard presentation={presentResource(resource)} compact />
          </View>
        ))}
      </View>
      <Text style={styles.caption}>
        Values are shown as recorded. This demo does not assess whether results are normal or
        provide clinical advice.
      </Text>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Other records
      </Text>
      <ResourceCard presentation={presentResource(organization)} compact />
      <View style={styles.demo}>
        <Text style={styles.caption}>Developer / synthetic demo</Text>
        <Link href="/profile-inspection" style={styles.demoLink}>
          Explore FHIR profile inspection (demo)
        </Link>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, marginBottom: 4 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  heading: { color: colors.ink, fontSize: 36, lineHeight: 43, fontWeight: '700', maxWidth: 600 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 24, maxWidth: 620 },
  section: { gap: 6, marginTop: 8 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  demo: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 20, gap: 6 },
  demoLink: { color: colors.accent, fontSize: 15, fontWeight: '600', paddingVertical: 10 },
});
