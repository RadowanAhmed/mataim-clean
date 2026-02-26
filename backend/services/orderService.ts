// backend/services/orderService.ts
import { supabase } from "../supabase";
import { DriverMatchingService } from "./driverMatchingService";
import { NotificationService } from "./notificationService";

// Order status management functions
export class OrderService {
  // Update order status with notifications
  static async updateOrderStatus(
    orderId: string,
    newStatus: string,
    userId?: string,
  ) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      // Send notification based on status change
      await NotificationService.sendOrderNotification(orderId, newStatus, {
        updated_by: userId,
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating order status:", error);
      return { success: false, error };
    }
  }

  // Restaurant accepts order
  static async acceptOrder(orderId: string, restaurantId: string) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "preparing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("restaurant_id", restaurantId);

      if (error) throw error;

      // Send notifications
      await NotificationService.sendOrderNotification(orderId, "preparing");

      return { success: true };
    } catch (error) {
      console.error("Error accepting order:", error);
      return { success: false, error };
    }
  }

  // Restaurant marks order as ready
  static async markOrderReady(orderId: string, restaurantId: string) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("restaurant_id", restaurantId);

      if (error) throw error;

      // Send notifications
      await NotificationService.sendOrderNotification(orderId, "ready");

      // Try to auto-assign driver
      await DriverMatchingService.autoAssignDriver(orderId);

      return { success: true };
    } catch (error) {
      console.error("Error marking order as ready:", error);
      return { success: false, error };
    }
  }

  // Driver picks up order
  static async driverPickupOrder(orderId: string, driverId: string) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "out_for_delivery",
          driver_id: driverId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      // Update driver status
      await supabase
        .from("delivery_users")
        .update({
          driver_status: "busy",
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      // Send notifications
      await NotificationService.sendDriverAssignmentNotification(
        orderId,
        driverId,
      );
      await NotificationService.sendOrderNotification(
        orderId,
        "out_for_delivery",
      );

      return { success: true };
    } catch (error) {
      console.error("Error in driver pickup:", error);
      return { success: false, error };
    }
  }

  // Driver marks order as delivered
  static async driverDeliverOrder(orderId: string, driverId: string) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "delivered",
          actual_delivery_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("driver_id", driverId);

      if (error) throw error;

      // Update driver status and earnings
      const { data: order } = await supabase
        .from("orders")
        .select("final_amount")
        .eq("id", orderId)
        .single();

      if (order) {
        await supabase
          .from("delivery_users")
          .update({
            driver_status: "available",
            total_deliveries: supabase.sql`total_deliveries + 1`,
            earnings_today: supabase.sql`earnings_today + ${order.final_amount * 0.8}`, // 80% to driver
            total_earnings: supabase.sql`total_earnings + ${order.final_amount * 0.8}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", driverId);
      }

      // Send notifications
      await NotificationService.sendOrderNotification(orderId, "delivered");

      return { success: true };
    } catch (error) {
      console.error("Error delivering order:", error);
      return { success: false, error };
    }
  }

  // Cancel order
  static async cancelOrder(orderId: string, userId: string, reason?: string) {
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      // Send cancellation notification
      await NotificationService.sendOrderNotification(orderId, "cancelled", {
        cancelled_by: userId,
        reason,
      });

      return { success: true };
    } catch (error) {
      console.error("Error cancelling order:", error);
      return { success: false, error };
    }
  }

  // Get order details
  static async getOrderDetails(orderId: string) {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          customers:users!orders_customer_id_fkey(*),
          restaurants:restaurants!orders_restaurant_id_fkey(*),
          driver:delivery_users(*),
          order_items(*)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error("Error getting order details:", error);
      return { success: false, error };
    }
  }
}
