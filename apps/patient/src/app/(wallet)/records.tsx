import { StyleSheet, Text, View } from 'react-native';
import { resourceReference } from '@myfhir/fhir-core';
import { presentResource } from '@myfhir/fhir-renderer';
import { patient } from '@myfhir/synthetic';
import { demoOrganizations } from '../../data/demoRecords';
import {
  catalogRecordParams,
  recordsAcquisitionIssues,
  recordsCatalog,
  rendererNativeResource,
} from '../../data/clinicalCatalog';
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
      {recordsCatalog.groups.map((group) => (
        <View key={group.category} style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {group.label} · {group.items.length}
          </Text>
          {group.items.map((item) => (
            <View key={item.key} style={styles.section}>
              <Text selectable style={styles.description}>
                Source: {item.identity.sourceNamespace} · {item.resourceType}/
                {item.identity.logicalId}
              </Text>
              <ResourceCard
                presentation={presentResource(rendererNativeResource(item))}
                recordParams={catalogRecordParams(item)}
                compact
              />
              {item.category === 'unclassified' ? (
                <Text style={styles.description}>Classification: {item.reason}.</Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
      {!recordsCatalog.groups.length ? (
        <Text style={styles.description}>No synthetic clinical records are available.</Text>
      ) : null}
      {recordsAcquisitionIssues.map((issue) => (
        <Text key={issue} style={styles.description}>
          Acquisition notice: {issue}
        </Text>
      ))}
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
