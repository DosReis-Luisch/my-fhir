import { useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { resourceReference } from '@myfhir/fhir-core';
import { presentResource } from '@myfhir/fhir-renderer';
import { resources } from '@myfhir/synthetic';
import { Page } from '../../ui/Page';
import { BackToWallet } from '../../ui/BackToWallet';
import { ResourceCard } from '../../ui/ResourceCard';
import {
  catalogRecordParams,
  findCatalogRecord,
  rendererNativeResource,
  recordsCatalog,
} from '../../data/clinicalCatalog';
import { colors } from '../../ui/theme';

export default function RecordDetails() {
  const params = useLocalSearchParams<{
    id: string | string[];
    source: string | string[];
    type: string | string[];
    version: string | string[];
  }>();
  const [showSource, setShowSource] = useState(false);
  const qualified =
    params.source !== undefined || params.type !== undefined || params.version !== undefined;
  const catalogItem = qualified ? findCatalogRecord(params) : undefined;
  // Preserve old fixed-demo links; qualified links never fall back to bare IDs.
  const resource = catalogItem
    ? rendererNativeResource(catalogItem)
    : qualified
      ? undefined
      : resources.find((item) => item.id === params.id);
  const presentation = resource ? presentResource(resource) : undefined;
  return (
    <Page>
      <BackToWallet fallback="/records" />
      {resource ? (
        <>
          {presentation ? <ResourceCard presentation={presentation} /> : null}
          {catalogItem?.resourceType === 'DiagnosticReport' ? (
            <View style={styles.source}>
              <Text accessibilityRole="header" style={styles.title}>
                Supplied result references
              </Text>
              <Text style={styles.caption}>
                Links identify local records, not clinical validation or approval of report/results.
                Report and result statuses are independent. No reference ranges are interpreted.
              </Text>
              {!catalogItem.relationships.length ? (
                <Text style={styles.caption}>No result references supplied.</Text>
              ) : null}
              {catalogItem.relationships.map((relationship) => {
                const target =
                  relationship.resolution === 'resolved'
                    ? recordsCatalog.items.find((item) => item.record === relationship.target)
                    : undefined;
                return (
                  <View key={relationship.path} style={styles.source}>
                    <Text selectable style={styles.caption}>
                      {relationship.path}:{' '}
                      {relationship.reference ?? 'Unsupported reference assertion'}
                    </Text>
                    {target && presentation?.kind === 'diagnostic-report' ? (
                      <ResourceCard
                        presentation={presentResource(rendererNativeResource(target))}
                        recordParams={catalogRecordParams(target)}
                        compact
                      />
                    ) : target ? (
                      <Link
                        href={{ pathname: '/record/[id]', params: catalogRecordParams(target) }}
                        style={styles.link}
                        accessibilityLabel={`View original result ${target.identity.logicalId}`}
                      >
                        View original Observation: {target.identity.logicalId}
                      </Link>
                    ) : (
                      <Text style={styles.caption}>
                        Unresolved:{' '}
                        {relationship.resolution === 'unresolved'
                          ? relationship.reason
                          : 'local-target-unavailable'}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}
          <View style={styles.source}>
            {catalogItem ? (
              <Text selectable style={styles.caption}>
                Source: {catalogItem.identity.sourceNamespace} · Patient:{' '}
                {catalogItem.patientContext.patientId}
                {' · '}Version: {catalogItem.versionId ?? 'not supplied'}. Context is not
                authorization.
              </Text>
            ) : null}
            <Text style={styles.caption}>Original record · {resourceReference(resource)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showSource }}
              onPress={() => setShowSource((value) => !value)}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.link}>
                {showSource ? 'Hide original FHIR record' : 'View original FHIR record'}
              </Text>
            </Pressable>
            {showSource ? (
              <Text selectable style={styles.code}>
                {JSON.stringify(resource, null, 2)}
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={styles.caption}>This record was not found in the synthetic demo.</Text>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600', paddingVertical: 6 },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  source: { gap: 10 },
  button: { alignSelf: 'flex-start', padding: 10, borderRadius: 8, backgroundColor: colors.soft },
  pressed: { opacity: 0.7 },
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
