import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DeliverySettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const restaurantData = params.restaurantData
    ? JSON.parse(params.restaurantData as string)
    : null;

  const [formData, setFormData] = useState({
    delivery_radius: restaurantData?.delivery_radius?.toString() || "5",
    delivery_fee: restaurantData?.delivery_fee?.toString() || "5.00",
    min_order_amount: restaurantData?.min_order_amount?.toString() || "20.00",
    estimated_delivery_time: restaurantData?.estimated_delivery_time || "30-45",
    free_delivery_threshold:
      restaurantData?.free_delivery_threshold?.toString() || "50.00",
    pickup_instructions: restaurantData?.pickup_instructions || "",
  });

  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = {
        delivery_radius: parseInt(formData.delivery_radius) || 5,
        delivery_fee: parseFloat(formData.delivery_fee) || 5.0,
        min_order_amount: parseFloat(formData.min_order_amount) || 20.0,
        estimated_delivery_time: formData.estimated_delivery_time,
        free_delivery_threshold:
          parseFloat(formData.free_delivery_threshold) || 50.0,
        pickup_instructions: formData.pickup_instructions || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("restaurants")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;

      Alert.alert("Success", "Delivery settings saved successfully", [
        {
          text: "Continue",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error saving delivery settings:", error);
      Alert.alert("Error", error.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Settings</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionDescription}>
            Configure your delivery and pickup settings
          </Text>

          {/* Delivery Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Settings</Text>

            <View style={styles.inputRow}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Delivery Radius (km) *</Text>
                <View style={styles.unitInput}>
                  <TextInput
                    style={styles.unitInputField}
                    value={formData.delivery_radius}
                    onChangeText={(text) =>
                      setFormData((prev) => ({
                        ...prev,
                        delivery_radius: text,
                      }))
                    }
                    keyboardType="number-pad"
                    placeholder="5"
                  />
                  <Text style={styles.unitLabel}>km</Text>
                </View>
              </View>

              <View style={styles.halfInput}>
                <Text style={styles.label}>Delivery Fee (AED) *</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>AED</Text>
                  <TextInput
                    style={styles.currencyInputField}
                    value={formData.delivery_fee}
                    onChangeText={(text) =>
                      setFormData((prev) => ({ ...prev, delivery_fee: text }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="5.00"
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Min Order (AED) *</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>AED</Text>
                  <TextInput
                    style={styles.currencyInputField}
                    value={formData.min_order_amount}
                    onChangeText={(text) =>
                      setFormData((prev) => ({
                        ...prev,
                        min_order_amount: text,
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="20.00"
                  />
                </View>
              </View>

              <View style={styles.halfInput}>
                <Text style={styles.label}>Free Delivery Over (AED)</Text>
                <View style={styles.currencyInput}>
                  <Text style={styles.currencySymbol}>AED</Text>
                  <TextInput
                    style={styles.currencyInputField}
                    value={formData.free_delivery_threshold}
                    onChangeText={(text) =>
                      setFormData((prev) => ({
                        ...prev,
                        free_delivery_threshold: text,
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="50.00"
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Estimated Delivery Time</Text>
              <TextInput
                style={styles.textInput}
                value={formData.estimated_delivery_time}
                onChangeText={(text) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimated_delivery_time: text,
                  }))
                }
                placeholder="e.g., 30-45 minutes"
              />
            </View>
          </View>

          {/* Pickup Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup Instructions</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={formData.pickup_instructions}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, pickup_instructions: text }))
              }
              placeholder="Add pickup instructions for customers..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>
              e.g., "Pickup from the front counter", "Wait in the lobby", etc.
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.saveButtonText}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="navigate-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save & Continue</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => router.back()}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  form: {
    padding: 20,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
    textAlign: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  unitInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 6,
    borderWidth: 0.4,
    borderColor: "#6B7280",
    overflow: "hidden",
  },
  unitInputField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  unitLabel: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 0.4,
    borderColor: "#6B7280",
    overflow: "hidden",
  },
  currencySymbol: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
  },
  currencyInputField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  inputGroup: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0.4,
    borderColor: "#6B7280",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 24,
  },
  saveButtonDisabled: {
    backgroundColor: "#9CA3AF",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
});
