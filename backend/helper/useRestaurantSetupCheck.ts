import { useAuth } from "@/backend/AuthContext";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";
import { getRestaurantSetupStatus } from "./restaurantSetup";

export const useRestaurantSetupCheck = (screenName: string) => {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const checkSetup = async () => {
      if (user?.user_type === "restaurant") {
        const { isComplete, missingFields } = await getRestaurantSetupStatus(
          user.id,
        );

        if (!isComplete) {
          const missingCount = missingFields.length;
          const message =
            missingCount === 5
              ? "Please complete your restaurant profile setup."
              : `Please complete ${missingCount} more setup step${missingCount > 1 ? "s" : ""} to access ${screenName}.`;

          Alert.alert("Setup Required", message, [
            {
              text: "Complete Setup",
              onPress: () =>
                router.replace({
                  pathname: "/(restaurant)/setup",
                  params: { userId: user.id },
                }),
            },
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => router.back(),
            },
          ]);
        }
      }
    };

    checkSetup();
  }, [user]);
};
