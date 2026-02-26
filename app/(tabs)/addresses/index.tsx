//app/(tabs)/addresses/index
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// UAE Emirates list
const UAE_EMIRATES = [
  { id: "dubai", name: "Dubai" },
  { id: "abu-dhabi", name: "Abu Dhabi" },
  { id: "sharjah", name: "Sharjah" },
  { id: "ajman", name: "Ajman" },
  { id: "ras-al-khaimah", name: "Ras Al Khaimah" },
  { id: "fujairah", name: "Fujairah" },
  { id: "umm-al-quwain", name: "Umm Al Quwain" },
];

export default function AddressesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Add/Edit Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form states - INITIALIZED PROPERLY
  const [formData, setFormData] = useState({
    label: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "UAE",
    postal_code: "",
    latitude: null as number | null,
    longitude: null as number | null,
    is_default: false,
  });

  // Location states
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapLocation, setMapLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);

  // Fetch addresses on mount
  useEffect(() => {
    if (user?.id) {
      fetchAddresses();
    }
  }, [user?.id]);

  const fetchAddresses = async () => {
    try {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user?.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      Alert.alert("Error", "Failed to load addresses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAddresses();
  };

  const handleGetCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      setLocationError(null);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(
          "Location permission denied. Please enable location services.",
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode[0]) {
        const address = reverseGeocode[0];
        const addressLine1 =
          `${address.street || address.name || ""} ${address.streetNumber || ""}`.trim();
        const city = address.city || address.region || "Dubai";

        setFormData((prev) => ({
          ...prev,
          address_line1: addressLine1 || "Current Location",
          address_line2: address.district || "",
          city: city,
          state: address.region || "",
          postal_code: address.postalCode || "",
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }));

        // Suggest a label based on location
        if (!prev.label && address.street) {
          setFormData((prev) => ({
            ...prev,
            label: address.street.substring(0, 20) || "Current Location",
          }));
        }

        Alert.alert(
          "Location Found",
          "Your current location has been filled in.",
        );
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setLocationError(
        "Failed to get current location. Please try again or enter manually.",
      );
    } finally {
      setGettingLocation(false);
    }
  };

  const openMapForLocation = () => {
    // Open Google Maps for location selection
    if (formData.latitude && formData.longitude) {
      // If we have coordinates, open at that location
      const url = `https://www.google.com/maps/search/?api=1&query=${formData.latitude},${formData.longitude}`;
      Linking.openURL(url).catch(() => {
        Alert.alert(
          "Error",
          "Could not open Google Maps. Please install Google Maps app.",
        );
      });
    } else {
      // Get current location first
      handleGetCurrentLocation().then(() => {
        if (formData.latitude && formData.longitude) {
          const url = `https://www.google.com/maps/search/?api=1&query=${formData.latitude},${formData.longitude}`;
          Linking.openURL(url).catch(() => {
            Alert.alert(
              "Error",
              "Could not open Google Maps. Please install Google Maps app.",
            );
          });
        }
      });
    }
  };

  const openAddModal = () => {
    setEditingAddress(null);
    setFormData({
      label: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      country: "UAE",
      postal_code: "",
      latitude: null,
      longitude: null,
      is_default: addresses.length === 0,
    });
    setShowModal(true);
  };

  const openEditModal = (address: any) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || "",
      city: address.city,
      state: address.state || "",
      country: address.country || "UAE",
      postal_code: address.postal_code || "",
      latitude: address.latitude,
      longitude: address.longitude,
      is_default: address.is_default,
    });
    setShowModal(true);
  };

  const handleSaveAddress = async () => {
    // Validation
    if (!formData.label.trim()) {
      Alert.alert("Error", "Please enter a label (Home, Work, etc.)");
      return;
    }

    if (!formData.address_line1.trim()) {
      Alert.alert("Error", "Please enter your address");
      return;
    }

    if (!formData.city.trim()) {
      Alert.alert("Error", "Please select your city/emirate");
      return;
    }

    try {
      setSaving(true);

      const addressData = {
        user_id: user?.id,
        label: formData.label.trim(),
        address_line1: formData.address_line1.trim(),
        address_line2: formData.address_line2.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        country: formData.country,
        postal_code: formData.postal_code.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        is_default: formData.is_default,
        updated_at: new Date().toISOString(),
      };

      // If setting as default, unset all other defaults first
      if (formData.is_default) {
        await supabase
          .from("addresses")
          .update({ is_default: false })
          .eq("user_id", user?.id)
          .eq("is_default", true);
      }

      let result;
      if (editingAddress) {
        // Update existing address
        result = await supabase
          .from("addresses")
          .update(addressData)
          .eq("id", editingAddress.id)
          .select()
          .single();
      } else {
        // Insert new address
        result = await supabase
          .from("addresses")
          .insert([
            {
              ...addressData,
              created_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();
      }

      if (result.error) throw result.error;

      Alert.alert(
        "Success",
        editingAddress
          ? "Address updated successfully"
          : "Address added successfully",
      );

      setShowModal(false);
      fetchAddresses();
    } catch (error: any) {
      console.error("Error saving address:", error);
      Alert.alert("Error", error.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = (addressId: string) => {
    Alert.alert(
      "Delete Address",
      "Are you sure you want to delete this address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("addresses")
                .delete()
                .eq("id", addressId);

              if (error) throw error;

              fetchAddresses();
              Alert.alert("Success", "Address deleted successfully");
            } catch (error) {
              console.error("Error deleting address:", error);
              Alert.alert("Error", "Failed to delete address");
            }
          },
        },
      ],
    );
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      // Unset all other defaults
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user?.id)
        .eq("is_default", true);

      // Set new default
      const { error } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", addressId);

      if (error) throw error;

      fetchAddresses();
      Alert.alert("Success", "Default address updated");
    } catch (error) {
      console.error("Error setting default address:", error);
      Alert.alert("Error", "Failed to set default address");
    }
  };

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddress(addressId);
    const selected = addresses.find((addr) => addr.id === addressId);

    // Pass selected address back to previous screen
    router.push({
      pathname: "..",
      params: {
        selectedAddressId: addressId,
        selectedAddress: JSON.stringify(selected),
      },
    });
  };

  const getAddressIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case "home":
        return <Ionicons name="home" size={20} color="#FF6B35" />;
      case "work":
        return <Ionicons name="business" size={20} color="#3B82F6" />;
      case "apartment":
        return <Ionicons name="business" size={20} color="#10B981" />;
      case "villa":
        return <Ionicons name="home" size={20} color="#8B5CF6" />;
      default:
        return <Ionicons name="location" size={20} color="#6B7280" />;
    }
  };

  const renderAddressItem = ({ item }: { item: any }) => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressIconContainer}>
          {getAddressIcon(item.label)}
        </View>
        <View style={styles.addressInfo}>
          <View style={styles.addressTitleRow}>
            <Text style={styles.addressLabel}>{item.label}</Text>
            {item.is_default && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          <Text style={styles.addressText} numberOfLines={1}>
            {item.address_line1}
            {item.address_line2 && `, ${item.address_line2}`}
          </Text>
          <Text style={styles.addressCity}>
            {item.city}, {item.country}
          </Text>
          {item.latitude && item.longitude && (
            <Text style={styles.coordinatesText}>
              📍 {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.addressActions}>
        {!item.is_default && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetDefault(item.id)}
          >
            <Ionicons name="star-outline" size={16} color="#6B7280" />
            <Text style={styles.actionText}>Set as Default</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create-outline" size={16} color="#6B7280" />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteAddress(item.id)}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
          <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => handleSelectAddress(item.id)}
        >
          <Text style={styles.selectButtonText}>Select</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading addresses...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <TouchableOpacity onPress={openAddModal}>
          <Ionicons name="add" size={22} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {addresses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyStateTitle}>No addresses yet</Text>
          <Text style={styles.emptyStateText}>
            Add your delivery addresses to get started
          </Text>
          <TouchableOpacity
            style={styles.addFirstButton}
            onPress={openAddModal}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addFirstButtonText}>
              Add Your First Address
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          renderItem={renderAddressItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={
            <View style={styles.infoSection}>
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <Text style={styles.infoText}>
                {addresses.length} saved address
                {addresses.length !== 1 ? "es" : ""}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={styles.footerSpacer} />}
        />
      )}

      {/* Add/Edit Address Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !saving && setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAddress ? "Edit Address" : "Add New Address"}
              </Text>
              <TouchableOpacity
                onPress={() => !saving && setShowModal(false)}
                disabled={saving}
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <FlatList
              data={[1]}
              renderItem={() => (
                <View style={styles.form}>
                  {/* Label */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Label *</Text>
                    <View style={styles.labelOptions}>
                      {["Home", "Work", "Apartment", "Villa", "Other"].map(
                        (label) => (
                          <TouchableOpacity
                            key={label}
                            style={[
                              styles.labelOption,
                              formData.label === label &&
                                styles.labelOptionActive,
                            ]}
                            onPress={() => setFormData({ ...formData, label })}
                          >
                            <Text
                              style={[
                                styles.labelOptionText,
                                formData.label === label &&
                                  styles.labelOptionTextActive,
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ),
                      )}
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Custom label (e.g., My Office)"
                      placeholderTextColor="#9CA3AF"
                      value={formData.label}
                      onChangeText={(text) =>
                        setFormData({ ...formData, label: text })
                      }
                      maxLength={30}
                    />
                  </View>

                  {/* Location Buttons */}
                  <View style={styles.locationButtons}>
                    <TouchableOpacity
                      style={styles.locationButton}
                      onPress={handleGetCurrentLocation}
                      disabled={gettingLocation}
                    >
                      <Ionicons
                        name="locate"
                        size={18}
                        color={gettingLocation ? "#9CA3AF" : "#FF6B35"}
                      />
                      <Text
                        style={[
                          styles.locationButtonText,
                          gettingLocation && styles.locationButtonTextDisabled,
                        ]}
                      >
                        {gettingLocation
                          ? "Getting Location..."
                          : "Use Current Location"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.locationButton, styles.mapButton]}
                      onPress={openMapForLocation}
                    >
                      <Ionicons name="map" size={18} color="#3B82F6" />
                      <Text
                        style={[
                          styles.locationButtonText,
                          styles.mapButtonText,
                        ]}
                      >
                        Pick on Google Maps
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {locationError && (
                    <Text style={styles.errorText}>{locationError}</Text>
                  )}

                  {formData.latitude && formData.longitude && (
                    <View style={styles.coordinatesDisplay}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#10B981"
                      />
                      <Text style={styles.coordinatesText}>
                        Location: {formData.latitude.toFixed(6)},{" "}
                        {formData.longitude.toFixed(6)}
                      </Text>
                    </View>
                  )}

                  {/* Address Line 1 */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Address Line 1 *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Building number, street name"
                      placeholderTextColor="#9CA3AF"
                      value={formData.address_line1}
                      onChangeText={(text) =>
                        setFormData({ ...formData, address_line1: text })
                      }
                      maxLength={200}
                    />
                  </View>

                  {/* Address Line 2 */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Address Line 2 (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Apartment, suite, unit number"
                      placeholderTextColor="#9CA3AF"
                      value={formData.address_line2}
                      onChangeText={(text) =>
                        setFormData({ ...formData, address_line2: text })
                      }
                      maxLength={200}
                    />
                  </View>

                  {/* City/Emirate */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Emirate *</Text>
                    <View style={styles.emiratesGrid}>
                      {UAE_EMIRATES.map((emirate) => (
                        <TouchableOpacity
                          key={emirate.id}
                          style={[
                            styles.emirateOption,
                            formData.city === emirate.name &&
                              styles.emirateOptionActive,
                          ]}
                          onPress={() =>
                            setFormData({ ...formData, city: emirate.name })
                          }
                        >
                          <Text
                            style={[
                              styles.emirateOptionText,
                              formData.city === emirate.name &&
                                styles.emirateOptionTextActive,
                            ]}
                          >
                            {emirate.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Area/State */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Area/Community (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., Downtown, Marina, Khalifa City"
                      placeholderTextColor="#9CA3AF"
                      value={formData.state}
                      onChangeText={(text) =>
                        setFormData({ ...formData, state: text })
                      }
                      maxLength={100}
                    />
                  </View>

                  {/* Postal Code */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Postal Code (Optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 12345"
                      placeholderTextColor="#9CA3AF"
                      value={formData.postal_code}
                      onChangeText={(text) =>
                        setFormData({ ...formData, postal_code: text })
                      }
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                  </View>

                  {/* Country */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Country</Text>
                    <View style={styles.countryBadge}>
                      <Text style={styles.countryText}>
                        United Arab Emirates 🇦🇪
                      </Text>
                    </View>
                  </View>

                  {/* Set as Default */}
                  <TouchableOpacity
                    style={styles.defaultOption}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        is_default: !formData.is_default,
                      })
                    }
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: formData.is_default
                            ? "#FF6B35"
                            : "#F3F4F6",
                          borderColor: formData.is_default
                            ? "#FF6B35"
                            : "#D1D5DB",
                        },
                      ]}
                    >
                      {formData.is_default && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </View>
                    <View style={styles.defaultOptionText}>
                      <Text style={styles.defaultOptionTitle}>
                        Set as default address
                      </Text>
                      <Text style={styles.defaultOptionSubtitle}>
                        This address will be selected by default for deliveries
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />

            {/* Save Button */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveAddress}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={editingAddress ? "checkmark-circle" : "add-circle"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.saveButtonText}>
                      {editingAddress ? "Update Address" : "Save Address"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  addFirstButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#1E40AF",
    fontWeight: "500",
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  addressHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  addressIconContainer: {
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: "#FF6B3510",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 11,
    color: "#FF6B35",
    fontWeight: "600",
  },
  addressText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
    lineHeight: 20,
  },
  addressCity: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  coordinatesText: {
    fontSize: 11,
    color: "#6B7280",
    fontStyle: "italic",
  },
  addressActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  deleteButton: {
    backgroundColor: "#FEF2F2",
  },
  deleteText: {
    color: "#EF4444",
  },
  selectButton: {
    marginLeft: "auto",
    backgroundColor: "#FF6B35",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  footerSpacer: {
    height: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  form: {
    padding: 20,
    paddingBottom: 120,
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
  labelOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  labelOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  labelOptionActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  labelOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  labelOptionTextActive: {
    color: "#FF6B35",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
  },
  locationButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  locationButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF6B3510",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF6B3520",
  },
  mapButton: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F620",
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
  mapButtonText: {
    color: "#3B82F6",
  },
  locationButtonTextDisabled: {
    color: "#9CA3AF",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginBottom: 12,
    textAlign: "center",
  },
  coordinatesDisplay: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B98110",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  emiratesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emirateOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emirateOptionActive: {
    backgroundColor: "#FF6B3510",
    borderColor: "#FF6B35",
  },
  emirateOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  emirateOptionTextActive: {
    color: "#FF6B35",
  },
  countryBadge: {
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  countryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  defaultOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 24,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  defaultOptionText: {
    flex: 1,
  },
  defaultOptionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  defaultOptionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  modalFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    backgroundColor: "#FF6B3580",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
