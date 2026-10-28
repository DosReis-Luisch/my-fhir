import { Tabs } from 'expo-router';
import { colors } from '../../ui/theme';

export default function WalletLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarItemStyle: { minHeight: 48, paddingVertical: 8 },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelPosition: 'beside-icon',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home' }} />
      <Tabs.Screen
        name="records"
        options={{ title: 'Records', tabBarAccessibilityLabel: 'Records' }}
      />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarAccessibilityLabel: 'Me' }} />
    </Tabs>
  );
}
