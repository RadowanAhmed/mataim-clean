// app/(restaurant)/orders/OrderActions.tsx - FIXED
import { useAuth } from "@/backend/AuthContext";
import { DriverOrderMatchingService } from "@/backend/services/DriverOrderMatchingService";
import { OrderService } from "@/backend/services/orderService";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface OrderActionsProps {
  orderId: string;
  currentStatus: string;
  onStatusChange: () => void;
}

const OrderActions: React.FC<OrderActionsProps> = ({
  orderId,
  currentStatus,
  onStatusChange,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAcceptOrder = async () => {
    if (!user?.id) return;

    Alert.alert("Accept Order", "Are you sure you want to accept this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Accept",
        onPress: async () => {
          const result = await OrderService.acceptOrder(orderId, user.id);
          if (result.success) {
            Alert.alert("Success", "Order accepted successfully!");
            onStatusChange();
          } else {
            Alert.alert("Error", "Failed to accept order");
          }
        },
      },
    ]);
  };

  const handleMarkAsReady = async () => {
    if (!user?.id) return;

    Alert.alert("Mark as Ready", "Mark this order as ready for pickup?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Ready",
        onPress: async () => {
          setLoading(true);
          const result = await OrderService.markOrderReady(orderId, user.id);
          if (result.success) {
            Alert.alert("Success", "Order marked as ready!");

            // 🔴 Broadcast to drivers automatically
            await DriverOrderMatchingService.broadcastAvailableOrder(orderId);

            onStatusChange();
          } else {
            Alert.alert("Error", "Failed to update order");
          }
          setLoading(false);
        },
      },
    ]);
  };

  const handleFindDriver = async () => {
    if (!user?.id) return;

    Alert.alert("Find Driver", "Search for available drivers for this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Find Driver",
        onPress: async () => {
          setLoading(true);

          Alert.alert(
            "Finding Driver",
            "Looking for available drivers nearby...",
            [],
            { cancelable: false },
          );

          const broadcastResult =
            await DriverOrderMatchingService.broadcastAvailableOrder(orderId);

          if (broadcastResult) {
            Alert.alert(
              "✅ Driver Search Started",
              "We've notified nearby drivers. They have 5 minutes to accept.",
              [{ text: "OK" }],
            );
          } else {
            Alert.alert(
              "⚠️ No Drivers Available",
              "No drivers are online at the moment. The order will stay ready.",
              [{ text: "OK" }],
            );
          }

          setLoading(false);
        },
      },
    ]);
  };

  const handleCancelOrder = async () => {
    if (!user?.id) return;

    Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          const result = await OrderService.cancelOrder(
            orderId,
            user.id,
            "Cancelled by restaurant",
          );
          if (result.success) {
            Alert.alert("Success", "Order cancelled successfully");
            onStatusChange();
          } else {
            Alert.alert("Error", "Failed to cancel order");
          }
        },
      },
    ]);
  };

  if (currentStatus === "pending") {
    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleAcceptOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.acceptButtonText}>Accept Order</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={handleCancelOrder}
        >
          <Ionicons name="close" size={16} color="#EF4444" />
          <Text style={styles.cancelButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentStatus === "preparing") {
    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.readyButton]}
          onPress={handleMarkAsReady}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.readyButtonText}>Mark as Ready</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (currentStatus === "ready") {
    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.assignButton]}
          onPress={handleFindDriver}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="bicycle" size={16} color="#fff" />
              <Text style={styles.assignButtonText}>Find Driver</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (currentStatus === "out_for_delivery") {
    return (
      <View style={styles.statusContainer}>
        <Ionicons name="bicycle" size={16} color="#3B82F6" />
        <Text style={styles.statusText}>
          Driver assigned - Order on the way
        </Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: "#10B981",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  cancelButtonText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
  readyButton: {
    backgroundColor: "#FF6B35",
  },
  readyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  assignButton: {
    backgroundColor: "#3B82F6",
  },
  assignButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3B82F6",
    flex: 1,
    justifyContent: "center",
  },
  statusText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default OrderActions;
