import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: 'MyFHIR | Overview' }} />
        <Stack.Screen
          name="profile-inspection"
          options={{ title: 'MyFHIR | Profile inspection demo' }}
        />
        <Stack.Screen name="record/[id]" options={{ title: 'MyFHIR | Record' }} />
      </Stack>
    </>
  );
}
