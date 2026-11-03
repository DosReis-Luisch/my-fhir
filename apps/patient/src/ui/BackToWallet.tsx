import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from './theme';

/** Use real navigation history when available, including the originating wallet tab. */
export function BackToWallet({ fallback }: { fallback: '/records' | '/me' | '/trends' }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to wallet"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace(fallback);
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>← Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  label: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
