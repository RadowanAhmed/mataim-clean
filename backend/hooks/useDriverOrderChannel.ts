// hooks/useDriverOrderChannel.ts
import { useAuth } from "@/backend/AuthContext";
import { DriverOrderMatchingService } from "@/backend/services/DriverOrderMatchingService";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

export interface AvailableOrder {
  id: string;
  order_number: string;
  restaurant_name: string;
  restaurant_address: string;
  distance_km: number | null;
  estimated_time: number | null;
  delivery_fee: number;
  final_amount: number;
  items_count: number;
  special_instructions?: string;
}

export const useDriverOrderChannel = () => {
  const { user } = useAuth();
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const [latestOrder, setLatestOrder] = useState<AvailableOrder | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (user?.user_type === "driver" && user?.id) {
      console.log("🔔 Setting up driver order channel for:", user.id);

      // Subscribe to driver's personal channel
      unsubscribeRef.current = DriverOrderMatchingService.subscribeDriver(
        user.id,
        {
          onNewOrder: (order) => {
            console.log("📦 New available order received:", order.order_number);

            // Add to available orders list
            setAvailableOrders((prev) => {
              // Check if order already exists
              if (prev.some((o) => o.id === order.id)) {
                return prev;
              }
              return [order, ...prev];
            });

            // Show alert for new order
            setLatestOrder(order);
            setShowNewOrderAlert(true);

            // Play sound/vibrate
            if (Platform.OS === "ios") {
              // Use haptics
            } else {
              // Use vibration
            }
          },
          onOrderUnavailable: (data) => {
            console.log("❌ Order no longer available:", data.order_number);

            // Remove from available orders
            setAvailableOrders((prev) =>
              prev.filter((order) => order.id !== data.order_id),
            );
          },
        },
      );

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    }
  }, [user?.id, user?.user_type]);

  const acceptOrder = async (orderId: string) => {
    if (!user?.id) return false;

    const result = await DriverOrderMatchingService.acceptOrder(
      orderId,
      user.id,
    );

    if (result.success) {
      // Remove from available orders
      setAvailableOrders((prev) =>
        prev.filter((order) => order.id !== orderId),
      );
      setShowNewOrderAlert(false);
      return true;
    } else {
      Alert.alert("Error", result.error || "Failed to accept order");
      return false;
    }
  };

  const dismissAlert = () => {
    setShowNewOrderAlert(false);
    setLatestOrder(null);
  };

  return {
    availableOrders,
    showNewOrderAlert,
    latestOrder,
    acceptOrder,
    dismissAlert,
  };
};
