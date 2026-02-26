// app/(driver)/OrderAlert.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Alert } from "react-native";

interface OrderAlertProps {
  isOnline: boolean;
}

const OrderAlert: React.FC<OrderAlertProps> = ({ isOnline }) => {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !isOnline) return;

    // Subscribe to new orders assigned to this driver
    const orderSubscription = supabase
      .channel(`driver-assignments-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          const order = payload.new;

          // Show alert when driver is assigned to a new order
          if (
            payload.old.driver_id !== user.id &&
            order.driver_id === user.id
          ) {
            // Small delay to ensure order details are loaded
            setTimeout(() => {
              Alert.alert(
                "🚴 New Delivery Assigned!",
                `You've been assigned to deliver order #${order.order_number}.`,
                [
                  {
                    text: "Later",
                    style: "cancel",
                    onPress: () => {
                      // Navigate to orders screen
                      setTimeout(() => router.push("/(driver)/orders"), 100);
                    },
                  },
                  {
                    text: "View Details",
                    onPress: () => {
                      router.push(`/(driver)/orders/${order.id}`);
                    },
                  },
                ],
                { cancelable: false },
              );
            }, 500);
          }
        },
      )
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
    };
  }, [user?.id, isOnline, router]);

  return null;
};

export default OrderAlert;
