import { useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { resourceReference } from '@myfhir/fhir-core';
import { presentResource } from '@myfhir/fhir-renderer';
import { resources } from '@myfhir/synthetic';
import { Page } from '../../ui/Page';
import { ResourceCard } from '../../ui/ResourceCard';
import { colors } from '../../ui/theme';

export default function RecordDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showSource, setShowSource] = useState(false);
  const resource = resources.find((item) => item.id === id);
  return (
    <Page>
      <Link href="/" style={styles.link}>
        ← Back to overview
      </Link>
      {resource ? (
        <>
          <ResourceCard presentation={presentResource(resource)} />
          <View style={styles.source}>
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
