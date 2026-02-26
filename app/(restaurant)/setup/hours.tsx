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
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIME_SLOTS = [
  "6:00 AM",
  "7:00 AM",
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
  "9:00 PM",
  "10:00 PM",
  "11:00 PM",
  "12:00 AM",
];

export default function BusinessHoursScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userId = params.userId as string;
  const restaurantData = params.restaurantData
    ? JSON.parse(params.restaurantData as string)
    : null;

  const [hours, setHours] = useState(
    restaurantData?.opening_hours
      ? JSON.parse(restaurantData.opening_hours)
      : DAYS_OF_WEEK.reduce((acc, day) => {
          acc[day] = { open: "", close: "", closed: false };
          return acc;
        }, {} as any),
  );

  const [loading, setLoading] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedType, setSelectedType] = useState<"open" | "close">("open");

  const handleDayToggle = (day: string) => {
    setHours((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        closed: !prev[day].closed,
      },
    }));
  };

  const handleTimeSelect = (
    day: string,
    type: "open" | "close",
    time: string,
  ) => {
    setHours((prev: any) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: time,
      },
    }));
  };

  const openTimePicker = (day: string, type: "open" | "close") => {
    setSelectedDay(day);
    setSelectedType(type);
    setTimePickerVisible(true);
  };

  const formatHoursForDisplay = () => {
    const days = Object.entries(hours);
    const grouped: any = {};

    days.forEach(([day, data]: any) => {
      const key = `${data.open}-${data.close}-${data.closed}`;
      if (!grouped[key]) {
        grouped[key] = {
          days: [],
          open: data.open,
          close: data.close,
          closed: data.closed,
        };
      }
      grouped[key].days.push(day.substring(0, 3));
    });

    return Object.values(grouped)
      .map((group: any) => {
        if (group.closed) {
          return `${group.days.join(", ")}: Closed`;
        }
        return `${group.days.join(", ")}: ${group.open} - ${group.close}`;
      })
      .join("\n");
  };

  const validateHours = () => {
    for (const day of DAYS_OF_WEEK) {
      const dayHours = hours[day];
      if (!dayHours.closed) {
        if (!dayHours.open || !dayHours.close) {
          Alert.alert("Error", `Please set hours for ${day}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateHours()) return;

    setLoading(true);
    try {
      const updates = {
        opening_hours: JSON.stringify(hours),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("restaurants")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;

      Alert.alert("Success", "Business hours saved successfully", [
        {
          text: "Continue",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Error saving hours:", error);
      Alert.alert("Error", error.message || "Failed to save hours");
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
          <Text style={styles.headerTitle}>Business Hours</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionDescription}>
            Set your restaurant's opening hours
          </Text>

          {/* Preview */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Hours Preview</Text>
            <Text style={styles.previewText}>
              {formatHoursForDisplay() || "No hours set"}
            </Text>
          </View>

          {/* Hours Editor */}
          <View style={styles.hoursContainer}>
            {DAYS_OF_WEEK.map((day) => {
              const dayHours = hours[day];
              return (
                <View key={day} style={styles.dayRow}>
                  <TouchableOpacity
                    style={styles.dayHeader}
                    onPress={() => handleDayToggle(day)}
                  >
                    <View style={styles.dayCheckbox}>
                      {!dayHours.closed && (
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.dayText,
                        dayHours.closed && styles.closedDayText,
                      ]}
                    >
                      {day}
                    </Text>
                    <Text style={styles.dayStatus}>
                      {dayHours.closed ? "Closed" : "Open"}
                    </Text>
                  </TouchableOpacity>

                  {!dayHours.closed && (
                    <View style={styles.timeSelectors}>
                      <TouchableOpacity
                        style={styles.timeSelector}
                        onPress={() => openTimePicker(day, "open")}
                      >
                        <Ionicons name="time-outline" size={16} color="#666" />
                        <Text style={styles.timeText}>
                          {dayHours.open || "Open time"}
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.timeSeparator}>to</Text>

                      <TouchableOpacity
                        style={styles.timeSelector}
                        onPress={() => openTimePicker(day, "close")}
                      >
                        <Ionicons name="time-outline" size={16} color="#666" />
                        <Text style={styles.timeText}>
                          {dayHours.close || "Close time"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Quick Presets */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsTitle}>Quick Presets</Text>
            <View style={styles.presetButtons}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => {
                  const newHours = DAYS_OF_WEEK.reduce((acc, day) => {
                    acc[day] = {
                      open: "9:00 AM",
                      close: "10:00 PM",
                      closed: false,
                    };
                    return acc;
                  }, {} as any);
                  setHours(newHours);
                }}
              >
                <Text style={styles.presetButtonText}>9AM-10PM</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => {
                  const newHours = DAYS_OF_WEEK.reduce((acc, day) => {
                    const closed = day === "Sunday";
                    acc[day] = {
                      open: closed ? "" : "8:00 AM",
                      close: closed ? "" : "9:00 PM",
                      closed,
                    };
                    return acc;
                  }, {} as any);
                  setHours(newHours);
                }}
              >
                <Text style={styles.presetButtonText}>8AM-9PM (Sun off)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => {
                  const newHours = DAYS_OF_WEEK.reduce((acc, day) => {
                    acc[day] = { open: "", close: "", closed: true };
                    return acc;
                  }, {} as any);
                  setHours(newHours);
                }}
              >
                <Text style={styles.presetButtonText}>Set All Closed</Text>
              </TouchableOpacity>
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

      {/* Time Picker Modal */}
      <Modal
        visible={timePickerVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.timeModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedType === "open" ? "Opening Time" : "Closing Time"}
              </Text>
              <TouchableOpacity onPress={() => setTimePickerVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.timeList}>
              {TIME_SLOTS.map((time, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.timeItem}
                  onPress={() => {
                    handleTimeSelect(selectedDay, selectedType, time);
                    setTimePickerVisible(false);
                  }}
                >
                  <Text style={styles.timeItemText}>{time}</Text>
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
  previewCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  previewText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  hoursContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 24,
    overflow: "hidden",
  },
  dayRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  dayCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  dayText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  closedDayText: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  dayStatus: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  timeSelectors: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  timeSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  timeText: {
    fontSize: 14,
    color: "#374151",
  },
  timeSeparator: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  presetsContainer: {
    marginBottom: 24,
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  presetButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetButton: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  presetButtonText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
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
  timeModal: {
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
  timeList: {
    padding: 16,
  },
  timeItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  timeItemText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
  },
});
