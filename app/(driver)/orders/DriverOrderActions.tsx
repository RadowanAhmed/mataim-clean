// app/(driver)/orders/DriverOrderActions.tsx
import { useAuth } from "@/backend/AuthContext";
import { OrderService } from "@/backend/services/orderService";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface DriverOrderActionsProps {
  orderId: string;
  currentStatus: string;
  onStatusChange: () => void;
}

const DriverOrderActions: React.FC<DriverOrderActionsProps> = ({
  orderId,
  currentStatus,
  onStatusChange,
}) => {
  const { user } = useAuth();

  const handlePickupOrder = async () => {
    if (!user?.id) return;

    Alert.alert("Pick Up Order", "Confirm that you have picked up the order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm Pickup",
        onPress: async () => {
          const result = await OrderService.driverPickupOrder(orderId, user.id);
          if (result.success) {
            Alert.alert("Success", "Order picked up successfully!");
            onStatusChange();
          } else {
            Alert.alert("Error", "Failed to update order");
          }
        },
      },
    ]);
  };

  const handleDeliverOrder = async () => {
    if (!user?.id) return;

    Alert.alert(
      "Mark as Delivered",
      "Confirm that you have delivered the order?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Delivered",
          onPress: async () => {
            const result = await OrderService.driverDeliverOrder(
              orderId,
              user.id,
            );
            if (result.success) {
              Alert.alert("Success", "Order marked as delivered!");
              onStatusChange();
            } else {
              Alert.alert("Error", "Failed to update order");
            }
          },
        },
      ],
    );
  };

  if (currentStatus === "ready") {
    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.pickupButton]}
          onPress={handlePickupOrder}
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.pickupButtonText}>Pick Up Order</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentStatus === "out_for_delivery") {
    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deliverButton]}
          onPress={handleDeliverOrder}
        >
          <Ionicons name="checkmark-done" size={16} color="#fff" />
          <Text style={styles.deliverButtonText}>Mark as Delivered</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  actionsContainer: {
    marginTop: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  pickupButton: {
    backgroundColor: "#10B981",
  },
  pickupButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  deliverButton: {
    backgroundColor: "#FF6B35",
  },
  deliverButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default DriverOrderActions;
