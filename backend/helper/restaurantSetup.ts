import { supabase } from "../supabase";

export interface SetupRequirements {
  restaurant_name?: string;
  cuisine_type?: string;
  address?: string;
  business_license?: string;
  opening_hours?: string;
  setup_completed?: boolean;
}

export const checkRestaurantSetupComplete = async (
  userId: string,
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("setup_completed")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error checking setup:", error);
      return false;
    }

    return data?.setup_completed || false;
  } catch (error) {
    console.error("Error in checkRestaurantSetupComplete:", error);
    return false;
  }
};

export const getRestaurantSetupStatus = async (
  userId: string,
): Promise<{
  isComplete: boolean;
  missingFields: string[];
  restaurantData?: SetupRequirements;
}> => {
  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select(
        "restaurant_name, cuisine_type, address, business_license, opening_hours, setup_completed",
      )
      .eq("id", userId)
      .single();

    if (error || !data) {
      return {
        isComplete: false,
        missingFields: [
          "restaurant_name",
          "cuisine_type",
          "address",
          "business_license",
          "opening_hours",
        ],
      };
    }

    const missingFields: string[] = [];
    if (!data.restaurant_name) missingFields.push("Restaurant Name");
    if (!data.cuisine_type) missingFields.push("Cuisine Type");
    if (!data.address) missingFields.push("Address");
    if (!data.business_license) missingFields.push("Business License");
    if (!data.opening_hours) missingFields.push("Opening Hours");

    return {
      isComplete: data.setup_completed || false,
      missingFields,
      restaurantData: data,
    };
  } catch (error) {
    console.error("Error getting setup status:", error);
    return {
      isComplete: false,
      missingFields: [
        "restaurant_name",
        "cuisine_type",
        "address",
        "business_license",
        "opening_hours",
      ],
    };
  }
};

export const redirectToSetupIfIncomplete = async (
  userId: string,
  router: any,
  screenName: string,
): Promise<boolean> => {
  const { isComplete, missingFields } = await getRestaurantSetupStatus(userId);

  if (!isComplete) {
    const missingCount = missingFields.length;
    const message =
      missingCount === 5
        ? "Please complete your restaurant profile setup."
        : `Please complete ${missingCount} more setup step${missingCount > 1 ? "s" : ""} to create ${screenName}.`;

    Alert.alert("Setup Required", message, [
      {
        text: "Complete Setup",
        onPress: () =>
          router.replace({
            pathname: "/(restaurant)/setup",
            params: { userId },
          }),
      },
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => router.back(),
      },
    ]);
    return false;
  }

  return true;
};
