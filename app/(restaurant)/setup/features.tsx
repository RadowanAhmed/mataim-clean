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
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FEATURES = [
  {
    id: "has_delivery",
    name: "Delivery",
    icon: "bicycle-outline",
    color: "#FF6B35",
  },
  {
    id: "has_pickup",
    name: "Pickup",
    icon: "bag-handle-outline",
    color: "#10B981",
  },
  {
    id: "has_dine_in",
    name: "Dine-in",
    icon: "restaurant-outline",
    color: "#3B82F6",
  },
  {
    id: "has_outdoor",
    name: "Outdoor Seating",
    icon: "sunny-outline",
    color: "#F59E0B",
  },
  {
    id: "has_wifi",
    name: "Free Wi-Fi",
    icon: "wifi-outline",
    color: "#8B5CF6",
  },
  { id: "has_parking", name: "Parking", icon: "car-outline", color: "#EF4444" },
  {
    id: "is_family",
    name: "Family Friendly",
    icon: "people-outline",
    color: "#EC4899",
  },
  {
    id: "is_halal",
    name: "Halal Certified",
    icon: "star-outline",
    color: "#059669",
  },
];

const PAYMENT_METHODS = [
  { id: "cash", name: "Cash", icon: "cash-outline" },
  { id: "credit_card", name: "Credit Card", icon: "card-outline" },
  { id: "debit_card", name: "Debit Card", icon: "card-outline" },
  {
    id: "digital_wallet",
    name: "Digital Wallet",
    icon: "phone-portrait-outline",
  },
  { id: "bank_transfer", name: "Bank Transfer", icon: "business-outline" },
];

export default function FeaturesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const restaurantData = params.restaurantData
    ? JSON.parse(params.restaurantData as string)
    : null;

  const [features, setFeatures] = useState(
    restaurantData?.features
      ? JSON.parse(restaurantData.features)
      : FEATURES.reduce((acc, feature) => {
          acc[feature.id] = restaurantData?.[feature.id] || false;
          return acc;
        }, {}),
  );

  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    restaurantData?.payment_methods || ["cash", "credit_card"],
  );

  const [loading, setLoading] = useState(false);

  const toggleFeature = (featureId: string) => {
    setFeatures((prev: any) => ({
      ...prev,
      [featureId]: !prev[featureId],
    }));
  };

  const togglePaymentMethod = (methodId: string) => {
    setPaymentMethods((prev) =>
      prev.includes(methodId)
        ? prev.filter((id) => id !== methodId)
        : [...prev, methodId],
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = {
        ...features,
        payment_methods: paymentMethods,
        features: JSON.stringify(features),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("restaurants")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;

      Alert.alert("Success", "Features saved successfully", [
        {
          text: "Continue",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error saving features:", error);
      Alert.alert("Error", error.message || "Failed to save features");
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
          <Text style={styles.headerTitle}>Restaurant Features</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionDescription}>
            Configure your restaurant's features and services
          </Text>

          {/* Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services & Features</Text>
            <View style={styles.featuresGrid}>
              {FEATURES.map((feature) => (
                <TouchableOpacity
                  key={feature.id}
                  style={[
                    styles.featureButton,
                    features[feature.id] && styles.featureButtonActive,
                  ]}
                  onPress={() => toggleFeature(feature.id)}
                >
                  <View
                    style={[
                      styles.featureIconContainer,
                      features[feature.id] && {
                        backgroundColor: `${feature.color}20`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={feature.icon as any}
                      size={20}
                      color={features[feature.id] ? feature.color : "#6B7280"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.featureText,
                      features[feature.id] && styles.featureTextActive,
                    ]}
                  >
                    {feature.name}
                  </Text>
                  {features[feature.id] && (
                    <View style={styles.featureCheckmark}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={feature.color}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Payment Methods */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <Text style={styles.sectionDescription}>
              Select payment methods you accept
            </Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentButton,
                    paymentMethods.includes(method.id) &&
                      styles.paymentButtonActive,
                  ]}
                  onPress={() => togglePaymentMethod(method.id)}
                >
                  <Ionicons
                    name={method.icon as any}
                    size={20}
                    color={
                      paymentMethods.includes(method.id) ? "#FF6B35" : "#6B7280"
                    }
                  />
                  <Text
                    style={[
                      styles.paymentText,
                      paymentMethods.includes(method.id) &&
                        styles.paymentTextActive,
                    ]}
                  >
                    {method.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Additional Settings */}
          {(features.has_delivery || features.has_pickup) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Settings</Text>

              {features.has_delivery && (
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>
                    Minimum Order for Delivery
                  </Text>
                  <View style={styles.currencyInput}>
                    <Text style={styles.currencySymbol}>AED</Text>
                    <Text
                      style={styles.settingValue}
                      onPress={() =>
                        router.push({
                          pathname: "/(restaurant)/setup/delivery",
                          params: {
                            userId,
                            restaurantData: JSON.stringify({
                              ...restaurantData,
                              ...features,
                              payment_methods: paymentMethods,
                            }),
                          },
                        })
                      }
                    >
                      Set delivery settings
                    </Text>
                  </View>
                </View>
              )}

              {features.has_pickup && (
                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>Pickup Instructions</Text>
                  <Text
                    style={styles.settingValue}
                    onPress={() =>
                      router.push({
                        pathname: "/(restaurant)/setup/delivery",
                        params: {
                          userId,
                          restaurantData: JSON.stringify({
                            ...restaurantData,
                            ...features,
                            payment_methods: paymentMethods,
                          }),
                        },
                      })
                    }
                  >
                    Add pickup instructions
                  </Text>
                </View>
              )}
            </View>
          )}

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
                <Ionicons name="sparkles-outline" size={20} color="#fff" />
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
    marginBottom: 24,
    textAlign: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  featureButton: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  featureButtonActive: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FF6B35",
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "#F3F4F6",
  },
  featureText: {
    flex: 1,
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  featureTextActive: {
    color: "#FF6B35",
    fontWeight: "600",
  },
  featureCheckmark: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  paymentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  paymentButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  paymentButtonActive: {
    backgroundColor: "#FFF0E6",
    borderColor: "#FF6B35",
  },
  paymentText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  paymentTextActive: {
    color: "#FF6B35",
    fontWeight: "600",
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  currencyInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  currencySymbol: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
  },
  settingValue: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#374151",
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
