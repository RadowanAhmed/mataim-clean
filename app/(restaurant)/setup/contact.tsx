import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const COUNTRY_CODES = [
  { code: "+971", flag: "🇦🇪", name: "UAE", currency: "AED" },
  { code: "+256", flag: "🇺🇬", name: "Uganda", currency: "UGX" },
];

export default function ContactInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const restaurantData = params.restaurantData
    ? JSON.parse(params.restaurantData as string)
    : null;

  const [formData, setFormData] = useState({
    address: restaurantData?.address || "",
    phone: restaurantData?.phone || "",
    countryCode: restaurantData?.country_code || "+971",
    email: restaurantData?.email || "",
  });

  const [location, setLocation] = useState({
    latitude: restaurantData?.latitude || null,
    longitude: restaurantData?.longitude || null,
    locationCode: restaurantData?.location_code || "",
  });

  const [loading, setLoading] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  useEffect(() => {
    if (!location.latitude || !location.longitude) {
      getCurrentLocation();
    }
  }, []);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location permission is required");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        locationCode: generateLocationCode(
          loc.coords.latitude,
          loc.coords.longitude,
        ),
      };

      setLocation(newLocation);
      setSelectedLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const generateLocationCode = (lat: number, lng: number) => {
    const latCode = Math.abs(lat).toFixed(6).replace(".", "").substring(0, 6);
    const lngCode = Math.abs(lng).toFixed(6).replace(".", "").substring(0, 6);
    return `LOC-${latCode}-${lngCode}`;
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setSelectedLocation({
      ...selectedLocation,
      ...coordinate,
    });
    setLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      locationCode: generateLocationCode(
        coordinate.latitude,
        coordinate.longitude,
      ),
    });
  };

  const formatPhoneNumber = (text: string, countryCode: string) => {
    const cleanText = text.replace(/\D/g, "");
    let formatted = cleanText;

    if (countryCode === "+971") {
      if (cleanText.length > 6) {
        formatted = `${cleanText.slice(0, 2)} ${cleanText.slice(
          2,
          5,
        )} ${cleanText.slice(5, 9)}`;
      } else if (cleanText.length > 2) {
        formatted = `${cleanText.slice(0, 2)} ${cleanText.slice(2)}`;
      }
    } else if (countryCode === "+256") {
      if (cleanText.length > 6) {
        formatted = `${cleanText.slice(0, 3)} ${cleanText.slice(
          3,
          6,
        )} ${cleanText.slice(6, 9)}`;
      } else if (cleanText.length > 3) {
        formatted = `${cleanText.slice(0, 3)} ${cleanText.slice(3)}`;
      }
    }

    return formatted;
  };

  const handlePhoneChange = (text: string) => {
    const formattedPhone = formatPhoneNumber(text, formData.countryCode);
    setFormData((prev) => ({ ...prev, phone: formattedPhone }));
  };

  const handleCountrySelect = (country: any) => {
    setFormData((prev) => ({
      ...prev,
      countryCode: country.code,
      phone: "",
    }));
    setCountryModalVisible(false);
  };

  const validateForm = () => {
    if (!formData.address.trim()) {
      Alert.alert("Error", "Address is required");
      return false;
    }

    if (!formData.phone.trim()) {
      Alert.alert("Error", "Phone number is required");
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const updates = {
        address: formData.address.trim(),
        // Note: Phone is NOT saved to restaurants table as it's in users table
        latitude: location.latitude,
        longitude: location.longitude,
        location_code: location.locationCode,
        updated_at: new Date().toISOString(),
      };

      // Only update restaurant-specific data in restaurants table
      const { error: restaurantError } = await supabase
        .from("restaurants")
        .update(updates)
        .eq("id", userId);

      if (restaurantError) throw restaurantError;

      // Also update phone in users table if needed
      const { error: userError } = await supabase
        .from("users")
        .update({
          phone: formData.phone,
          country_code: formData.countryCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (userError) {
        console.warn("Could not update phone in users table:", userError);
      }

      Alert.alert("Success", "Contact information saved successfully", [
        {
          text: "Continue",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error saving contact info:", error);
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Details</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionDescription}>
            Set up your restaurant's contact information
          </Text>

          {/* Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TouchableOpacity
              style={styles.addressInput}
              onPress={() => setMapModalVisible(true)}
            >
              <Ionicons
                name="location-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <Text
                style={[
                  styles.addressText,
                  !formData.address && styles.placeholderText,
                ]}
                numberOfLines={2}
              >
                {formData.address || "Tap to select location"}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <View style={styles.phoneInputContainer}>
              <TouchableOpacity
                style={styles.countrySelector}
                onPress={() => setCountryModalVisible(true)}
              >
                <Text style={styles.flagText}>
                  {COUNTRY_CODES.find((c) => c.code === formData.countryCode)
                    ?.flag || "🇦🇪"}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>

              <Text style={styles.countryCodeText}>{formData.countryCode}</Text>

              <TextInput
                style={styles.phoneInput}
                placeholder={
                  formData.countryCode === "+971" ? "501234567" : "712345678"
                }
                value={formData.phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              placeholder="restaurant@email.com"
              value={formData.email}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, email: text }))
              }
              keyboardType="email-address"
              autoCapitalize="none"
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

      {/* Map Modal */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setMapModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.mapContainer}>
              {selectedLocation && (
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={selectedLocation}
                  onPress={handleMapPress}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                >
                  {location.latitude && location.longitude && (
                    <Marker
                      coordinate={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                      }}
                      pinColor="#FF6B35"
                    />
                  )}
                </MapView>
              )}
            </View>

            <View style={styles.locationInfo}>
              <Text style={styles.coordinatesText}>
                {location.latitude
                  ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                  : "Select location"}
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.myLocationButton}
                onPress={getCurrentLocation}
              >
                <Ionicons name="navigate" size={20} color="#FF6B35" />
                <Text style={styles.myLocationText}>My Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  if (location.latitude && location.longitude) {
                    setFormData((prev) => ({
                      ...prev,
                      address: `Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
                    }));
                  }
                  setMapModalVisible(false);
                }}
              >
                <Text style={styles.confirmButtonText}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Country Modal */}
      <Modal
        visible={countryModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.countryModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.countryList}>
              {COUNTRY_CODES.map((country, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.countryItem,
                    formData.countryCode === country.code &&
                      styles.selectedCountryItem,
                  ]}
                  onPress={() => handleCountrySelect(country)}
                >
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <View style={styles.countryInfo}>
                    <Text style={styles.countryName}>{country.name}</Text>
                    <Text style={styles.countryDetails}>
                      {country.code} • {country.currency}
                    </Text>
                  </View>
                  {formData.countryCode === country.code && (
                    <Ionicons name="checkmark" size={20} color="#FF6B35" />
                  )}
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
    marginBottom: 12,
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
  addressInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.3,
    borderColor: "#6B7280",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  placeholderText: {
    color: "#9CA3AF",
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.4,
    borderColor: "#6B7280",
    borderRadius: 8,
    overflow: "hidden",
  },
  countrySelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  flagText: {
    fontSize: 18,
    marginRight: 8,
  },
  countryCodeText: {
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0.4,
    borderColor: "#6B7280",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
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
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  countryModalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 250,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  locationInfo: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  coordinatesText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  myLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    gap: 8,
  },
  myLocationText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  confirmButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  countryList: {
    padding: 16,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  selectedCountryItem: {
    backgroundColor: "#FFF0E6",
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
    width: 40,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 2,
  },
  countryDetails: {
    fontSize: 14,
    color: "#6B7280",
  },
});
