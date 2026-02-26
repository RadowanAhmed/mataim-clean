// app/(tabs)/test-notifications.tsx
import { PushNotificationService } from "@/backend/services/PushNotificationService";
import React, { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function TestNotificationsScreen() {
  const [testing, setTesting] = useState(false);

  const testSound = async (soundName: string) => {
    await PushNotificationService.sendNotification(
      `Test: ${soundName}`,
      `Testing ${soundName} notification sound`,
      { test: true, sound: soundName },
      {
        sound: soundName,
        channelId: "orders",
        vibrate: true,
        priority: "high",
      },
    );
  };

  const testAllSounds = async () => {
    setTesting(true);
    await PushNotificationService.testNotificationSounds();
    setTesting(false);
  };

  const testOrderStatuses = async () => {
    const statuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ];

    for (const status of statuses) {
      await PushNotificationService.sendOrderNotification(
        `test-order-${Date.now()}`,
        `ORD-${Math.floor(Math.random() * 10000)}`,
        status,
        "Test Restaurant",
      );
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔔 Notification Sound Test</Text>
      <Text style={styles.subtitle}>Test different notification sounds</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Individual Sound Tests</Text>

        {[
          "Default",
          "New Order",
          "Order Ready",
          "Delivery",
          "Alert",
          "Success",
        ].map((sound) => (
          <TouchableOpacity
            key={sound}
            style={styles.button}
            onPress={() => testSound(sound.toLowerCase().replace(" ", "-"))}
          >
            <Text style={styles.buttonText}>Test {sound} Sound</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Status Tests</Text>
        <TouchableOpacity
          style={[styles.button, styles.orderButton]}
          onPress={testOrderStatuses}
          disabled={testing}
        >
          <Text style={styles.buttonText}>
            {testing ? "Testing..." : "Test All Order Statuses"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Complete Test</Text>
        <TouchableOpacity
          style={[styles.button, styles.completeButton]}
          onPress={testAllSounds}
          disabled={testing}
        >
          <Text style={styles.buttonText}>
            {testing ? "Playing Sounds..." : "Test All Sounds Sequence"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cleanup</Text>
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={() => PushNotificationService.clearAllNotifications()}
        >
          <Text style={styles.buttonText}>Clear All Notifications</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>📋 Instructions:</Text>
        <Text style={styles.instruction}>1. Make sure device volume is up</Text>
        <Text style={styles.instruction}>
          2. Grant notification permissions
        </Text>
        <Text style={styles.instruction}>
          3. Test on physical device (required)
        </Text>
        <Text style={styles.instruction}>
          4. Different sounds for different actions
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 30,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#3b82f6",
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  orderButton: {
    backgroundColor: "#10b981",
  },
  completeButton: {
    backgroundColor: "#f59e0b",
  },
  clearButton: {
    backgroundColor: "#ef4444",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  instructions: {
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 12,
  },
  instruction: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
    lineHeight: 20,
  },
});
