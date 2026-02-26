// app/(driver)/orders/_layout.tsx
import { Stack } from "expo-router";

export default function DriverOrdersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[orderId]" />
    </Stack>
  );
}
