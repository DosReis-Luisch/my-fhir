import { useState, type PropsWithChildren } from 'react';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DeclaredProfileMatch } from '@myfhir/fhir-core';
import { presentResourceWithProfiles, type ProfileFieldHint } from '@myfhir/fhir-renderer';
import { syntheticPulseObservation, syntheticPulseProfile } from '@myfhir/synthetic';
import { Page } from '../ui/Page';
import { colors } from '../ui/theme';

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function MetadataLine({ label, value }: { label: string; value: string | undefined }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value ?? 'Not supplied'}
      </Text>
    </View>
  );
}

function ProfileResolution({ profile }: { profile: DeclaredProfileMatch }) {
  return (
    <View style={styles.entry}>
      <MetadataLine label="Declaration (as supplied in meta.profile)" value={profile.declared} />
      <MetadataLine label="Local resolution status" value={profile.status} />
      {profile.status === 'resolved' ? (
        <>
          <MetadataLine label="Canonical URL" value={profile.definition.metadata.url} />
          <MetadataLine label="Business version" value={profile.definition.metadata.version} />
          <MetadataLine
            label="StructureDefinition title"
            value={profile.definition.metadata.title}
          />
          <MetadataLine label="StructureDefinition name" value={profile.definition.metadata.name} />
          <MetadataLine
            label="Snapshot metadata availability"
            value={
              profile.definition.status === 'available'
                ? 'Available for selected metadata inspection'
                : `Unavailable: ${profile.definition.reason}`
            }
          />
        </>
      ) : (
        <>
          <MetadataLine
            label="Snapshot metadata availability"
            value="Not inspected: no uniquely resolved definition"
          />
          {profile.status === 'unresolved' ? (
            <MetadataLine label="Resolution limitation" value={profile.reason} />
          ) : (
            <>
              <Text style={styles.note}>
                Multiple definitions match. No candidate was selected.
              </Text>
              {profile.candidates.map((candidate, index) => (
                <View key={`${candidate.url}:${candidate.version}:${index}`} style={styles.entry}>
                  <MetadataLine
                    label="Candidate title or name"
                    value={candidate.title ?? candidate.name}
                  />
                  <MetadataLine label="Candidate canonical URL" value={candidate.url} />
                  <MetadataLine label="Candidate business version" value={candidate.version} />
                </View>
              ))}
            </>
          )}
        </>
      )}
    </View>
  );
}

function FieldMetadata({ hint }: { hint: ProfileFieldHint }) {
  return (
    <View style={styles.entry}>
      <MetadataLine label="Presentation source path (not FHIRPath)" value={hint.sourcePath} />
      <MetadataLine label="StructureDefinition element path" value={hint.element.path} />
      <MetadataLine label="Element ID" value={hint.element.id} />
      <MetadataLine
        label="Declared element type codes"
        value={
          hint.element.type.length
            ? hint.element.type.map((type) => type.code).join(', ')
            : undefined
        }
      />
      {hint.element.short !== undefined ? (
        <MetadataLine label="Short description (profile metadata)" value={hint.element.short} />
      ) : null}
      {hint.element.mustSupport !== undefined ? (
        <MetadataLine
          label="mustSupport (profile metadata, not validation)"
          value={String(hint.element.mustSupport)}
        />
      ) : null}
      <MetadataLine label="Profile provenance (declared canonical)" value={hint.declared} />
    </View>
  );
}

export default function ProfileInspection() {
  const [showDetails, setShowDetails] = useState(false);
  const result = presentResourceWithProfiles(syntheticPulseObservation, [syntheticPulseProfile]);
  const { presentation } = result;

  return (
    <Page>
      <Link href="/" style={styles.link}>
        ← Back to overview
      </Link>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>DEVELOPER / SYNTHETIC DEMO</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          FHIR profile inspection
        </Text>
        <Text style={styles.note}>
          A read-only demonstration of local profile resolution and selected metadata. This is not a
          production profile inspector or a patient clinical assessment.
        </Text>
      </View>

      <View style={styles.boundary}>
        <Text accessibilityRole="header" style={styles.boundaryTitle}>
          Profile conformance has not been validated.
        </Text>
        <Text style={styles.note}>
          Declared means claimed by the resource. Resolved means a local definition was found.
          Available means selected snapshot metadata can be inspected. None of these establishes
          conformance.
        </Text>
        <MetadataLine label="Engine validation status" value={result.validation} />
      </View>

      <Section title="Observation summary">
        <MetadataLine label="Resource type" value={presentation.source.resourceType} />
        <Text accessibilityRole="header" style={styles.clinicalTitle}>
          {presentation.title}
        </Text>
        {presentation.fields.length ? (
          presentation.fields.map((field, index) => (
            <MetadataLine
              key={`${field.sourcePath}:${index}`}
              label={field.label}
              value={field.value}
            />
          ))
        ) : (
          <Text style={styles.note}>No clinical fields are available in this presentation.</Text>
        )}
        {presentation.kind === 'generic' ? (
          <View style={styles.warning}>
            <Text style={styles.boundaryTitle}>Summary withheld by the base renderer</Text>
            <Text style={styles.note}>
              Base-renderer notices describe its profile-unaware summary. The separate local
              resolution results below do not override its clinical fallback.
            </Text>
            {presentation.notices.map((notice, index) => (
              <Text key={index} style={styles.note}>
                {notice}
              </Text>
            ))}
          </View>
        ) : null}
      </Section>

      <Section title="Declared profiles and local resolution">
        {result.profiles.length ? (
          result.profiles.map((profile, index) => (
            <ProfileResolution key={`${profile.declared}:${index}`} profile={profile} />
          ))
        ) : (
          <Text style={styles.note}>No profiles were declared in this resource.</Text>
        )}
      </Section>

      <Section title="Matched field metadata">
        <Text style={styles.note}>
          Optional hints from the engine. Profile text and mustSupport do not change clinical labels
          or values and do not establish conformance.
        </Text>
        {result.fieldHints.length ? (
          result.fieldHints.map((hint, index) => (
            <FieldMetadata key={`${hint.declared}:${hint.sourcePath}:${index}`} hint={hint} />
          ))
        ) : (
          <Text style={styles.note}>
            No supported, unambiguous field hints are available. No metadata has been invented.
          </Text>
        )}
      </Section>

      <Section title="Limitations and engine notices">
        <Text style={styles.note}>
          This demo is not clinically validated. Snapshot completeness is not established. Hints do
          not alter clinical field values. There is no conformance validation, remote profile
          fetching, slicing interpretation or generated clinical form.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showDetails ? 'Hide detailed engine notices' : 'Show detailed engine notices'
          }
          accessibilityState={{ expanded: showDetails }}
          onPress={() => setShowDetails((shown) => !shown)}
          style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
        >
          <Text style={styles.link}>
            {showDetails ? 'Hide engine notices' : 'Show engine notices'}
          </Text>
        </Pressable>
        {showDetails ? (
          <View style={styles.entry}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Opt-in engine limitations
            </Text>
            {result.limitations.map((notice, index) => (
              <Text key={index} style={styles.note}>
                {notice}
              </Text>
            ))}
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Base-renderer notices
            </Text>
            <Text style={styles.note}>
              The base renderer does not resolve profiles. Its unresolved-profile notice is about
              that renderer, not a rejection of the separate local resolution results.
            </Text>
            {presentation.notices.map((notice, index) => (
              <Text key={index} style={styles.note}>
                {notice}
              </Text>
            ))}
          </View>
        ) : null}
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heading: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  section: {
    backgroundColor: colors.surface,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 18,
    minWidth: 0,
  },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '600' },
  clinicalTitle: { color: colors.ink, fontSize: 23, fontWeight: '600' },
  boundary: { padding: 20, borderLeftWidth: 4, borderColor: colors.ink, gap: 12 },
  boundaryTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  entry: { gap: 14, borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, minWidth: 0 },
  line: { gap: 5, minWidth: 0 },
  label: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  value: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 23,
    flexShrink: 1,
    minWidth: 0,
    width: '100%',
  },
  note: { color: colors.muted, fontSize: 14, lineHeight: 23 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600', paddingVertical: 8 },
  warning: { gap: 10, borderLeftWidth: 3, borderColor: colors.ink, paddingLeft: 14 },
  detailsButton: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.soft,
  },
  pressed: { opacity: 0.7 },
});
