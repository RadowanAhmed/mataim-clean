import { Stack } from "expo-router";
import React from "react";

export default function SetupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F9FAFB" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="basic" />
      <Stack.Screen name="contact" />
      <Stack.Screen name="hours" />
      <Stack.Screen name="license" />
      <Stack.Screen name="features" />
      <Stack.Screen name="delivery" />
      <Stack.Screen name="image" />
    </Stack>
  );
}
