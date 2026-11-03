import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import type { ResourcePresentation } from '@myfhir/fhir-renderer';
import { colors } from './theme';

export function ResourceCard({
  presentation,
  compact = false,
  recordParams,
}: {
  presentation: ResourcePresentation;
  compact?: boolean;
  recordParams?: { id: string; source: string; type: string; version?: string };
}) {
  const fields =
    compact && presentation.kind !== 'diagnostic-report'
      ? presentation.fields.filter(
          (field) => field.sourcePath !== 'effectiveDateTime' && field.sourcePath !== 'status',
        )
      : presentation.fields;
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{presentation.subtitle}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {presentation.title}
      </Text>
      <View style={styles.fields}>
        {fields.map((field) => (
          <View key={field.sourcePath} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <Text selectable style={styles.value}>
              {field.value}
            </Text>
          </View>
        ))}
      </View>
      {compact && presentation.source.id ? (
        <Link
          href={{
            pathname: '/record/[id]',
            params: recordParams ?? { id: presentation.source.id },
          }}
          style={styles.link}
          accessibilityLabel={`View ${presentation.title} record`}
        >
          View record →
        </Link>
      ) : null}
      {!compact || presentation.kind === 'generic'
        ? presentation.notices.map((notice) => (
            <Text key={notice} style={styles.notice}>
              {notice}
            </Text>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    minWidth: 0,
  },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  title: { color: colors.ink, fontSize: 23, lineHeight: 30, fontWeight: '600', flexShrink: 1 },
  fields: { gap: 14, marginVertical: 6 },
  field: { gap: 4, minWidth: 0 },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.ink, fontSize: 20, lineHeight: 28, fontWeight: '500', width: '100%' },
  link: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 12,
    minHeight: 48,
  },
  notice: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
