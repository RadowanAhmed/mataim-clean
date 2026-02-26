//app(restaurant)/setup/basic
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CUISINE_OPTIONS = [
  { value: "Arabic", label: "Arabic", icon: "🥙" },
  { value: "Indian", label: "Indian", icon: "🍛" },
  { value: "Chinese", label: "Chinese", icon: "🥡" },
  { value: "Italian", label: "Italian", icon: "🍝" },
  { value: "American", label: "American", icon: "🍔" },
  { value: "Mexican", label: "Mexican", icon: "🌮" },
  { value: "Japanese", label: "Japanese", icon: "🍣" },
  { value: "Thai", label: "Thai", icon: "🍲" },
  { value: "Mediterranean", label: "Mediterranean", icon: "🥗" },
  { value: "Fast Food", label: "Fast Food", icon: "🍟" },
];

export default function BasicInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const restaurantData = params.restaurantData
    ? JSON.parse(params.restaurantData as string)
    : null;

  const [formData, setFormData] = useState({
    restaurant_name: restaurantData?.restaurant_name || "",
    cuisine_type: restaurantData?.cuisine_type || "",
    description: restaurantData?.description || "",
  });

  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handleSave = async () => {
    if (!formData.restaurant_name.trim()) {
      Alert.alert("Error", "Restaurant name is required");
      return;
    }

    if (!formData.cuisine_type) {
      Alert.alert("Error", "Please select a cuisine type");
      return;
    }

    setLoading(true);
    try {
      // Update restaurant data
      const updates = {
        restaurant_name: formData.restaurant_name.trim(),
        cuisine_type: formData.cuisine_type,
        description: formData.description.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Check if restaurant exists
      const { data: existing } = await supabase
        .from("restaurants")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("restaurants")
          .update(updates)
          .eq("id", userId);

        if (error) throw error;
      } else {
        // Create new with basic data
        const newRestaurant = {
          id: userId,
          ...updates,
          created_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("restaurants")
          .insert([newRestaurant]);

        if (error) throw error;
      }

      Alert.alert("Success", "Basic information saved successfully", [
        {
          text: "Continue",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error saving basic info:", error);
      Alert.alert("Error", error.message || "Failed to save information");
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Basic Information</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionDescription}>
            Set up your restaurant's basic details
          </Text>

          {/* Restaurant Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Restaurant Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter restaurant name"
              value={formData.restaurant_name}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, restaurant_name: text }))
              }
              placeholderTextColor="#999"
            />
          </View>

          {/* Cuisine Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cuisine Type *</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => setDropdownVisible(true)}
            >
              <Text
                style={[
                  styles.selectInputText,
                  !formData.cuisine_type && styles.placeholderText,
                ]}
              >
                {formData.cuisine_type || "Select cuisine type"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe your restaurant (optional)"
              value={formData.description}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, description: text }))
              }
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
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
                <Ionicons name="save-outline" size={20} color="#fff" />
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

      {/* Cuisine Dropdown Modal */}
      <Modal visible={dropdownVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cuisine Type</Text>
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.dropdownList}>
              {CUISINE_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownItem,
                    formData.cuisine_type === option.value &&
                      styles.selectedItem,
                  ]}
                  onPress={() => {
                    setFormData((prev) => ({
                      ...prev,
                      cuisine_type: option.value,
                    }));
                    setDropdownVisible(false);
                  }}
                >
                  <Text style={styles.optionIcon}>{option.icon}</Text>
                  <Text
                    style={[
                      styles.dropdownItemText,
                      formData.cuisine_type === option.value &&
                        styles.selectedItemText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    marginBottom: 24,
    textAlign: "center",
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
    borderWidth: 0.3,
    borderColor: "#6B7280",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  selectInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.4,
    borderColor: "#6B7280",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectInputText: {
    fontSize: 16,
    color: "#111827",
  },
  placeholderText: {
    color: "#9CA3AF",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  dropdownModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e1e1",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  dropdownList: {
    padding: 16,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  selectedItem: {
    backgroundColor: "#FFF0E6",
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 12,
    width: 32,
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "400",
    flex: 1,
  },
  selectedItemText: {
    color: "#FF6B35",
    fontWeight: "500",
  },
});
