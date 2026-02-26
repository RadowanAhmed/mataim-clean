import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import { useAuth } from "./AuthContext";
import { RealTimeLocationService } from "./services/RealTimeLocationService";
import { supabase } from "./supabase";

interface LocationData {
  latitude: string;
  longitude: string;
  accuracy?: string;
  timestamp: string;
}

interface DriverLocation {
  driver_id: string;
  location: LocationData;
  order_id: string;
}

interface LocationContextType {
  driverLocations: Map<string, DriverLocation>;
  updateDriverLocation: (driverId: string, location: LocationData) => void;
  startTracking: (userId: string) => Promise<boolean>;
  stopTracking: () => void;
  isTracking: boolean;
  subscribeToDriverLocation: (orderId: string) => () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined,
);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within LocationProvider");
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  const [driverLocations, setDriverLocations] = useState<
    Map<string, DriverLocation>
  >(new Map());
  const [isTracking, setIsTracking] = useState(false);
  const { user } = useAuth();

  // Update driver location in state
  const updateDriverLocation = (driverId: string, location: LocationData) => {
    setDriverLocations((prev) => {
      const newMap = new Map(prev);

      // Find which order this driver is currently delivering
      const currentOrderId =
        Array.from(prev.values()).find((d) => d.driver_id === driverId)
          ?.order_id || "";

      newMap.set(driverId, {
        driver_id: driverId,
        location,
        order_id: currentOrderId,
      });

      return newMap;
    });
  };

  // Start location tracking for current user
  const startTracking = async (userId: string): Promise<boolean> => {
    const success = await RealTimeLocationService.startTracking(userId);
    setIsTracking(success);
    return success;
  };

  // Stop location tracking
  const stopTracking = () => {
    RealTimeLocationService.stopTracking();
    setIsTracking(false);
  };

  // Subscribe to driver location updates for a specific order
  const subscribeToDriverLocation = (orderId: string) => {
    const channel = supabase.channel(`location-updates-${orderId}`);

    channel
      .on("broadcast", { event: "location_update" }, (payload) => {
        const { driver_id, location } = payload.payload;
        updateDriverLocation(driver_id, location);
      })
      .subscribe();

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  // Auto-start tracking if user is a driver
  useEffect(() => {
    if (user?.user_type === "driver") {
      startTracking(user.id);
    }
  }, [user?.id, user?.user_type]);

  const value = {
    driverLocations,
    updateDriverLocation,
    startTracking,
    stopTracking,
    isTracking,
    subscribeToDriverLocation,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};
