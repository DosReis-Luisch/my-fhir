import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { presentResource } from '@myfhir/fhir-renderer';
import { patient } from '@myfhir/synthetic';
import { Page } from '../../ui/Page';
import { ResourceCard } from '../../ui/ResourceCard';
import { colors } from '../../ui/theme';

export default function Me() {
  return (
    <Page inTabs>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          Me
        </Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Synthetic patient context
        </Text>
        <Text style={styles.description}>
          This is the fictional FHIR Patient used throughout the demo. It is not a signed-in
          account, a verified identity or a statement of access permissions.
        </Text>
      </View>
      <ResourceCard presentation={presentResource(patient)} />
      <Link href={{ pathname: '/record/[id]', params: { id: patient.id } }} style={styles.link}>
        Open patient record →
      </Link>
      <View style={styles.demo}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Developer / demo
        </Text>
        <Text style={styles.description}>
          Inspect local FHIR profile metadata using synthetic data. This does not validate clinical
          information or profile conformance.
        </Text>
        <Link href="/profile-inspection" style={styles.link}>
          Explore FHIR profile inspection (demo)
        </Link>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 23 },
  link: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 12,
    minHeight: 48,
  },
  demo: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 24, gap: 12 },
});
