import * as Location from "expo-location";
import { supabase } from "../supabase";

export class RealTimeLocationService {
  private static locationSubscription: any = null;
  private static isTracking = false;
  private static updateInterval: NodeJS.Timeout | null = null;
  private static lastUpdateTime = 0;
  private static MIN_UPDATE_INTERVAL = 1000; // 1 second
  private static MAX_ACCURACY = 50; // 50 meters

  // Start tracking driver location
  static async startTracking(userId: string) {
    if (this.isTracking) return;

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Location permission denied");
        return false;
      }

      // Configure location accuracy
      const locationOptions: Location.LocationOptions = {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: this.MIN_UPDATE_INTERVAL,
        distanceInterval: 5, // Update every 5 meters movement
      };

      // Start location tracking
      this.locationSubscription = await Location.watchPositionAsync(
        locationOptions,
        async (location) => {
          await this.updateDriverLocation(userId, location.coords);
        },
      );

      // Start periodic updates even when not moving
      this.updateInterval = setInterval(async () => {
        await this.forceLocationUpdate(userId);
      }, this.MIN_UPDATE_INTERVAL);

      this.isTracking = true;
      console.log("📍 Location tracking started");
      return true;
    } catch (error) {
      console.error("Error starting location tracking:", error);
      return false;
    }
  }

  // Stop tracking
  static stopTracking() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.isTracking = false;
    console.log("📍 Location tracking stopped");
  }

  // Update driver location in database
  private static async updateDriverLocation(
    userId: string,
    coords: Location.LocationObjectCoords,
  ) {
    // Skip if accuracy is poor
    if (coords.accuracy && coords.accuracy > this.MAX_ACCURACY) {
      console.log("📍 Poor accuracy, skipping update");
      return;
    }

    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) {
      return;
    }

    try {
      const locationData = {
        latitude: coords.latitude.toString(),
        longitude: coords.longitude.toString(),
        accuracy: coords.accuracy?.toString(),
        altitude: coords.altitude?.toString(),
        heading: coords.heading?.toString(),
        speed: coords.speed?.toString(),
      };

      // Update in delivery_users table
      const { error } = await supabase
        .from("delivery_users")
        .update({
          current_location_lat: locationData.latitude,
          current_location_lng: locationData.longitude,
          location_accuracy: locationData.accuracy,
          last_location_update: new Date().toISOString(),
          is_online: true,
        })
        .eq("id", userId);

      if (error) {
        console.error("📍 Error updating driver location:", error);
        return;
      }

      this.lastUpdateTime = now;

      // Also update in orders table if driver is currently delivering
      await this.updateCurrentOrderLocation(userId, locationData);

      // Broadcast to all connected clients via WebSocket
      await this.broadcastLocationUpdate(userId, locationData);
    } catch (error) {
      console.error("📍 Error in updateDriverLocation:", error);
    }
  }

  // Update location in current order
  private static async updateCurrentOrderLocation(
    userId: string,
    locationData: any,
  ) {
    try {
      // Find active order for this driver
      const { data: activeOrder } = await supabase
        .from("orders")
        .select("id, restaurant_id, customer_id")
        .eq("driver_id", userId)
        .in("status", ["out_for_delivery", "ready"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (activeOrder) {
        // Update order with driver location
        await supabase
          .from("orders")
          .update({
            driver_location_lat: locationData.latitude,
            driver_location_lng: locationData.longitude,
            driver_location_updated_at: new Date().toISOString(),
          })
          .eq("id", activeOrder.id);

        // Store location history for tracking
        await supabase.from("location_history").insert({
          order_id: activeOrder.id,
          driver_id: userId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("📍 Error updating order location:", error);
    }
  }

  // Force location update (for periodic updates)
  private static async forceLocationUpdate(userId: string) {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await this.updateDriverLocation(userId, location.coords);
    } catch (error) {
      console.error("📍 Error forcing location update:", error);
    }
  }

  // Broadcast location to all connected clients
  private static async broadcastLocationUpdate(
    userId: string,
    locationData: any,
  ) {
    try {
      // Find which restaurant and customer need to know about this driver
      const { data: activeOrder } = await supabase
        .from("orders")
        .select("id, restaurant_id, customer_id")
        .eq("driver_id", userId)
        .in("status", ["out_for_delivery"])
        .single();

      if (!activeOrder) return;

      // Broadcast via Supabase Realtime
      const channel = supabase.channel(`location-updates-${activeOrder.id}`);

      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.send({
            type: "broadcast",
            event: "location_update",
            payload: {
              order_id: activeOrder.id,
              driver_id: userId,
              location: locationData,
              timestamp: new Date().toISOString(),
            },
          });
        }
      });
    } catch (error) {
      console.error("📍 Error broadcasting location:", error);
    }
  }

  // Get driver location
  static async getDriverLocation(driverId: string) {
    try {
      const { data } = await supabase
        .from("delivery_users")
        .select(
          "current_location_lat, current_location_lng, last_location_update",
        )
        .eq("id", driverId)
        .single();

      return data;
    } catch (error) {
      console.error("Error getting driver location:", error);
      return null;
    }
  }

  // Get location history for an order
  static async getOrderLocationHistory(orderId: string, limit: number = 50) {
    try {
      const { data } = await supabase
        .from("location_history")
        .select("*")
        .eq("order_id", orderId)
        .order("timestamp", { ascending: false })
        .limit(limit);

      return data;
    } catch (error) {
      console.error("Error getting location history:", error);
      return [];
    }
  }
}
