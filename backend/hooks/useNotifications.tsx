// backend/hooks/useNotifications.js
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export const useNotifications = () => {
  const router = useRouter();

  useEffect(() => {
    // Configure notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true, // Add this
        shouldShowList: true, // Add this
      }),
    });

    // Listen for notification taps
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped:", data);

        if (data.screen) {
          router.push(data.screen);
        }
      },
    );

    return () => subscription.remove();
  }, [router]);

  return null;
};
