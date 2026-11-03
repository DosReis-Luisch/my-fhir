import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { resourceReference } from '@myfhir/fhir-core';
import { presentResource } from '@myfhir/fhir-renderer';
import { resources } from '@myfhir/synthetic';
import { Page } from '../../ui/Page';
import { BackToWallet } from '../../ui/BackToWallet';
import { ResourceCard } from '../../ui/ResourceCard';
import { findCatalogRecord, rendererNativeResource } from '../../data/clinicalCatalog';
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
  return (
    <Page>
      <BackToWallet fallback="/records" />
      {resource ? (
        <>
          <ResourceCard presentation={presentResource(resource)} />
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
