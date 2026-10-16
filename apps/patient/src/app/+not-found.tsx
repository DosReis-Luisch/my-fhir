import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Page } from '../ui/Page';
import { colors } from '../ui/theme';

export default function NotFound() {
  return (
    <Page>
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 24 }}>
        Page not found
      </Text>
      <Link href="/" style={{ color: colors.accent, paddingVertical: 12 }}>
        Return to your overview
      </Link>
    </Page>
  );
}
