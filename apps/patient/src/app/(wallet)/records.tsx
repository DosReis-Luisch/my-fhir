import { StyleSheet, Text, View } from 'react-native';
import { resourceReference } from '@myfhir/fhir-core';
import { presentResource } from '@myfhir/fhir-renderer';
import { patient } from '@myfhir/synthetic';
import { demoOrganizations, demoPatientObservations } from '../../data/demoRecords';
import { Page } from '../../ui/Page';
import { ResourceCard } from '../../ui/ResourceCard';
import { colors } from '../../ui/theme';

export default function Records() {
  return (
    <Page inTabs>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          Records
        </Text>
        <Text style={styles.description}>
          Browse the synthetic records in this demo. This is not a complete clinical history. Open a
          record for its full summary and original FHIR data.
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.description}>Records for the synthetic patient</Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {presentResource(patient).title}
        </Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Clinical observations
        </Text>
        <Text style={styles.description}>
          Measurements recorded for the fictional patient shown above. Open a record for its
          available time and source information.
        </Text>
        {demoPatientObservations.map((resource) => (
          <ResourceCard
            key={resourceReference(resource)}
            presentation={presentResource(resource)}
            compact
          />
        ))}
        {!demoPatientObservations.length ? (
          <Text style={styles.description}>No synthetic clinical observations are available.</Text>
        ) : null}
      </View>
      <View style={styles.supporting}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Supporting Organization information
        </Text>
        <Text style={styles.description}>
          Separate demo context. These Organization resources are not patient clinical observations
          and do not establish a care relationship.
        </Text>
        {demoOrganizations.map((resource) => (
          <ResourceCard
            key={resourceReference(resource)}
            presentation={presentResource(resource)}
            compact
          />
        ))}
        {!demoOrganizations.length ? (
          <Text style={styles.description}>No supporting demo information is available.</Text>
        ) : null}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  heading: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 23 },
  supporting: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 24, gap: 16 },
});
