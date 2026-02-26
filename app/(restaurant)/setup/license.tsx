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

export default function BusinessLicenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const restaurantData = params.restaurantData
    ? JSON.parse(params.restaurantData as string)
    : null;

  const [formData, setFormData] = useState({
    business_license: restaurantData?.business_license || "",
    license_expiry: restaurantData?.license_expiry || "",
  });

  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!formData.business_license.trim()) {
      Alert.alert("Error", "Business license number is required");
      return;
    }

    setLoading(true);
    try {
      const updates = {
        business_license: formData.business_license.trim(),
        license_expiry: formData.license_expiry || null,
        is_verified: false, // Set to false initially, will be verified by admin
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("restaurants")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;

      Alert.alert(
        "Success",
        "Business license saved successfully. Your license will be verified by our team within 24-48 hours.",
        [
          {
            text: "Continue",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error: any) {
      console.error("Error saving license:", error);
      Alert.alert("Error", error.message || "Failed to save license");
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
          <Text style={styles.headerTitle}>Business License</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.form}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#3B82F6" />
            <Text style={styles.infoText}>
              Business license verification is required to operate as a
              restaurant on our platform. This information will be verified by
              our team.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business License Number *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter license number"
              value={formData.business_license}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, business_license: text }))
              }
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
            <Text style={styles.helperText}>
              Enter your official business license number issued by the
              authorities
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>License Expiry Date (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              value={formData.license_expiry}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, license_expiry: text }))
              }
              placeholderTextColor="#999"
            />
            <Text style={styles.helperText}>
              Format: YYYY-MM-DD (e.g., 2025-12-31)
            </Text>
          </View>

          {/* Requirements */}
          <View style={styles.requirementsCard}>
            <Text style={styles.requirementsTitle}>Requirements</Text>
            <View style={styles.requirementItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.requirementText}>
                Valid business license from local authorities
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.requirementText}>
                License should be in the restaurant's name
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.requirementText}>
                Food handling certificate (if required by local laws)
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.requirementText}>
                Health department approval
              </Text>
            </View>
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
                <Ionicons name="document-text-outline" size={20} color="#fff" />
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
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1E40AF",
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  helperText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
  },
  requirementsCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  requirementText: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 16,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
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
