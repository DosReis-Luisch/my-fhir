import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';

export function Page({ children, inTabs = false }: PropsWithChildren<{ inTabs?: boolean }>) {
  return (
    <SafeAreaView
      style={styles.safe}
      edges={inTabs ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <View style={styles.mark}>
              <Text style={styles.markText}>m</Text>
            </View>
            <Text style={styles.brand}>MyFHIR</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>SYNTHETIC DEMO</Text>
            </View>
          </View>
          {children}
          <Text style={styles.footer}>
            Your health, clearly connected. All data in this demo is fictional.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, paddingVertical: 24 },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', gap: 20 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  mark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: colors.surface, fontSize: 26, fontWeight: '700' },
  brand: { color: colors.ink, fontSize: 23, fontWeight: '700' },
  badge: {
    backgroundColor: colors.soft,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeText: { color: colors.accent, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 16 },
});
