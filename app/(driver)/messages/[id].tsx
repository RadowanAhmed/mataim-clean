// app/(driver)/messages/[id].tsx - WITH REFRESH ON NAVIGATION

import { useAuth } from "@/backend/AuthContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CLOUDINARY_CLOUD_NAME = "dz1arsa91";
const CLOUDINARY_UPLOAD_PRESET = "mataim_chat_preset";

export default function DriverChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const id = params.id as string;
  const orderId = params.orderId as string;
  const restaurantId = params.restaurantId as string;
  const customerId = params.customerId as string;
  const restaurantName = params.restaurantName as string;
  const restaurantImage = params.restaurantImage as string;
  const initialMessage = params.initialMessage as string;
  const orderNumber = params.orderNumber as string;
  const customerName = params.customerName as string;
  const customerImage = params.customerImage as string;

  // State
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [actualConversationId, setActualConversationId] = useState<
    string | null
  >(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);

  // Track the specific participant we're chatting with
  const [chatParticipant, setChatParticipant] = useState<{
    id: string;
    type: "customer" | "restaurant";
    name: string;
    image: string | null;
    phone: string | null;
  } | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const sendAnim = useRef(new Animated.Value(1)).current;
  const messageAnims = useRef<{ [key: string]: Animated.Value }>({}).current;

  // Use useFocusEffect to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log(
        "🚗 Driver chat screen focused - refreshing data for ID:",
        id,
      );

      if (id && user?.id && actualConversationId) {
        // Refresh immediately, don't wait
        Promise.all([
          fetchConversationDetails(actualConversationId),
          fetchMessages(actualConversationId),
        ]).catch(console.error);
      }

      return () => {
        console.log("🚗 Driver chat screen unfocused");
      };
    }, [id, user?.id, actualConversationId]),
  );

  // Initialize conversation
  useEffect(() => {
    if (user?.id) {
      initializeConversation();
    }
  }, [user?.id, id, orderId, restaurantId, customerId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages.length, loading]);

  const refreshChat = async () => {
    console.log("🔄 Refreshing driver chat data for ID:", id);
    setRefreshing(true);

    if (actualConversationId) {
      await fetchConversationDetails(actualConversationId);
      await fetchMessages(actualConversationId);
    }

    setRefreshing(false);
  };

  const initializeConversation = async () => {
    try {
      setLoading(true);

      // CRITICAL: Reset participant state for new chat
      setChatParticipant(null);
      setMessages([]);

      let convId = id;
      const otherPartyId = customerId || restaurantId;

      console.log(
        "Initializing conversation with ID:",
        id,
        "Other party:",
        otherPartyId,
      );

      // If it's a direct conversation ID
      if (id && !id.startsWith("order-") && !id.startsWith("new-")) {
        convId = id;
      }
      // If it's an order-based ID (driver chatting with customer)
      else if (id && id.startsWith("order-")) {
        const actualOrderId = id.replace("order-", "");

        const { data: order } = await supabase
          .from("orders")
          .select("customer_id")
          .eq("id", actualOrderId)
          .single();

        if (order) {
          setOrderDetails(order);

          // Set participant immediately
          setChatParticipant({
            id: order.customer_id,
            type: "customer",
            name: customerName || "Customer",
            image: customerImage || null,
            phone: null,
          });

          // Check for existing conversation
          const { data: existing } = await supabase
            .from("conversations")
            .select("id")
            .eq("customer_id", order.customer_id)
            .maybeSingle();

          if (existing) {
            convId = existing.id;
          } else {
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({
                customer_id: order.customer_id,
                is_active: true,
              })
              .select("id")
              .single();

            if (newConv) {
              convId = newConv.id;
            }
          }
        }
      }
      // If it's a new conversation with restaurant
      else if (id && id.startsWith("new-") && restaurantId) {
        // Set participant immediately
        setChatParticipant({
          id: restaurantId,
          type: "restaurant",
          name: restaurantName || "Restaurant",
          image: restaurantImage || null,
          phone: null,
        });

        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("restaurant_id", restaurantId)
          .maybeSingle();

        if (existing) {
          convId = existing.id;
        } else {
          const { data: newConv } = await supabase
            .from("conversations")
            .insert({
              restaurant_id: restaurantId,
              is_active: true,
            })
            .select("id")
            .single();

          if (newConv) {
            convId = newConv.id;
          }
        }
      }

      if (convId) {
        setActualConversationId(convId);

        // Fetch messages using the current params
        await fetchMessages(convId, customerId || restaurantId);

        // Fetch additional details in background
        fetchConversationDetails(convId);
        setupRealtime(convId);
      } else {
        Alert.alert("Error", "Could not initialize conversation");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error initializing conversation:", error);
      Alert.alert("Error", "Failed to load conversation");
      setLoading(false);
    }
  };

  const fetchConversationDetails = async (convId: string) => {
    try {
      const { data: convData, error } = await supabase
        .from("conversations")
        .select(
          `
          *,
          restaurant:restaurants!conversations_restaurant_id_fkey(
            id,
            restaurant_name,
            image_url
          ),
          customer:users!conversations_customer_id_fkey(
            id,
            full_name,
            profile_image_url,
            phone
          )
        `,
        )
        .eq("id", convId)
        .single();

      if (error) throw error;

      setConversation(convData);

      // If we haven't set chat participant yet, determine it from the conversation
      if (!chatParticipant) {
        if (convData.customer_id) {
          setChatParticipant({
            id: convData.customer_id,
            type: "customer",
            name: convData.customer?.full_name || "Customer",
            image: convData.customer?.profile_image_url || null,
            phone: convData.customer?.phone || null,
          });
        } else if (convData.restaurant_id) {
          setChatParticipant({
            id: convData.restaurant_id,
            type: "restaurant",
            name: convData.restaurant?.restaurant_name || "Restaurant",
            image: convData.restaurant?.image_url || null,
            phone: null, // Will fetch restaurant owner's phone separately
          });

          // Fetch restaurant owner's phone
          const { data: restaurantOwner } = await supabase
            .from("users")
            .select("phone")
            .eq("id", convData.restaurant_id)
            .single();

          if (restaurantOwner) {
            setChatParticipant((prev) =>
              prev
                ? {
                    ...prev,
                    phone: restaurantOwner.phone,
                  }
                : null,
            );
          }
        }
      }

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error("Error fetching conversation details:", error);
    }
  };

  const fetchMessages = async (convId: string, otherPartyId?: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
        *,
        sender:users!messages_sender_id_fkey(
          id,
          full_name,
          profile_image_url
        )
      `,
        )
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Use the passed ID or fall back to params
      const partyId = otherPartyId || customerId || restaurantId;

      // If no partyId, show all messages (shouldn't happen)
      if (!partyId) {
        console.warn("No partyId found for filtering");
        setMessages(data || []);
      } else {
        const filteredMessages = (data || []).filter(
          (msg) => msg.sender_id === user?.id || msg.sender_id === partyId,
        );
        setMessages(filteredMessages);
      }

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = (convId: string) => {
    const channel = supabase
      .channel(`driver-chat-${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        async (payload) => {
          if (payload.new.sender_id === user?.id) return;

          // Only add messages from our chat participant
          if (payload.new.sender_id !== chatParticipant?.id) {
            console.log(
              "Ignoring message from other participant:",
              payload.new.sender_id,
            );
            return;
          }

          const { data: completeMessage } = await supabase
            .from("messages")
            .select(
              `
              *,
              sender:users!messages_sender_id_fkey(
                id,
                full_name,
                profile_image_url
              )
            `,
            )
            .eq("id", payload.new.id)
            .single();

          if (completeMessage) {
            messageAnims[completeMessage.id] = new Animated.Value(0);
            setMessages((prev) => [...prev, completeMessage]);

            Animated.spring(messageAnims[completeMessage.id], {
              toValue: 1,
              friction: 5,
              tension: 40,
              useNativeDriver: true,
            }).start();

            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        },
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (
      !newMessage.trim() ||
      !user?.id ||
      !actualConversationId ||
      sending ||
      !chatParticipant
    )
      return;

    try {
      setSending(true);

      Animated.sequence([
        Animated.timing(sendAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(sendAnim, {
          toValue: 1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        conversation_id: actualConversationId,
        sender_id: user.id,
        message: newMessage.trim(),
        message_type: "text",
        created_at: new Date().toISOString(),
        sender: {
          id: user.id,
          full_name: "You",
          profile_image_url: user.profile_image_url,
        },
      };

      messageAnims[tempId] = new Animated.Value(0);
      setMessages((prev) => [...prev, optimisticMessage]);
      const messageText = newMessage.trim();
      setNewMessage("");

      Animated.spring(messageAnims[tempId], {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: actualConversationId,
          sender_id: user.id,
          message: messageText,
          message_type: "text",
        })
        .select(
          `
          *,
          sender:users!messages_sender_id_fkey(
            id,
            full_name,
            profile_image_url
          )
        `,
        )
        .single();

      if (error) throw error;

      await supabase
        .from("conversations")
        .update({
          last_message: messageText,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", actualConversationId);

      // Send notification to the correct participant
      if (chatParticipant) {
        NotificationService.sendMessageNotification(
          actualConversationId,
          user.id,
          messageText,
          user.full_name || "Driver",
          "driver",
          chatParticipant.id,
          chatParticipant.type,
        ).catch((err) => console.log("Notification error:", err));
      }

      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? data : msg)),
      );

      messageAnims[data.id] = messageAnims[tempId];
      delete messageAnims[tempId];
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-")));
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const uploadImage = async (asset: any) => {
    if (!user?.id || !actualConversationId || !chatParticipant) return;

    try {
      setUploadingImage(true);

      const tempId = `temp-img-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        conversation_id: actualConversationId,
        sender_id: user.id,
        message: "📷 Photo", // 🔴 FIX: Add a default message
        message_type: "image",
        image_url: asset.uri,
        created_at: new Date().toISOString(),
        sender: {
          id: user.id,
          full_name: "You",
          profile_image_url: user.profile_image_url,
        },
      };

      messageAnims[tempId] = new Animated.Value(0);
      setMessages((prev) => [...prev, optimisticMessage]);

      Animated.spring(messageAnims[tempId], {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        type: "image/jpeg",
        name: `chat-${user.id}-${Date.now()}.jpg`,
      } as any);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Upload failed");
      }

      const imageUrl = data.secure_url;

      // 🔴 FIX: Insert with proper message field
      const { data: messageData, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: actualConversationId,
          sender_id: user.id,
          message: "📷 Photo", // 🔴 FIX: Add a default message (database requires NOT NULL)
          message_type: "image",
          image_url: imageUrl,
        })
        .select(
          `
        *,
        sender:users!messages_sender_id_fkey(
          id,
          full_name,
          profile_image_url
        )
      `,
        )
        .single();

      if (error) throw error;

      // Update conversation last message
      await supabase
        .from("conversations")
        .update({
          last_message: "📷 Sent a photo",
          last_message_at: new Date().toISOString(),
        })
        .eq("id", actualConversationId);

      // Send notification
      if (chatParticipant) {
        NotificationService.sendMessageNotification(
          actualConversationId,
          user.id,
          "📷 Sent a photo",
          user.full_name || "Driver",
          "driver",
          chatParticipant.id,
          chatParticipant.type,
        ).catch((err) => console.log("Notification error:", err));
      }

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? messageData : msg)),
      );

      messageAnims[messageData.id] = messageAnims[tempId];
      delete messageAnims[tempId];
    } catch (error) {
      console.error("Error uploading image:", error);
      setMessages((prev) =>
        prev.filter((msg) => !msg.id.startsWith("temp-img-")),
      );
      Alert.alert("Error", "Failed to send image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera roll permissions.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image.");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera permissions.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo.");
    }
  };

  const showImageOptions = () => {
    Alert.alert("Send Photo", "Choose an option", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleCall = async () => {
    if (!chatParticipant?.phone) {
      Alert.alert("Error", "Phone number not available");
      return;
    }

    Linking.openURL(`tel:${chatParticipant.phone}`);
  };

  const handleViewOrder = () => {
    if (orderId) {
      router.push(`/(driver)/order-detail/${orderId}`);
    } else if (orderDetails?.id) {
      router.push(`/(driver)/order-detail/${orderDetails.id}`);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === user?.id;
    const isImage = item.message_type === "image" && item.image_url;

    // Get the current other party ID for THIS conversation
    const currentOtherPartyId = customerId || restaurantId;

    if (!isMe && item.sender_id !== currentOtherPartyId) {
      return null;
    }

    const animValue = messageAnims[item.id] || new Animated.Value(1);

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          isMe ? styles.messageContainerMe : styles.messageContainerOther,
          {
            opacity: animValue,
            transform: [
              {
                translateY: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
              {
                scale: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          },
        ]}
      >
        {!isMe && item.sender?.profile_image_url && (
          <Image
            source={{ uri: item.sender.profile_image_url }}
            style={styles.messageAvatar}
          />
        )}

        <View
          style={[
            styles.messageBubble,
            isImage && styles.messageBubbleImage,
            !isImage && isMe && styles.messageBubbleMe,
            !isImage && !isMe && styles.messageBubbleOther,
          ]}
        >
          {!isMe && !isImage && (
            <Text style={styles.senderName}>
              {chatParticipant?.type === "customer" ? "Customer" : "Restaurant"}
            </Text>
          )}

          {isImage ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.image_url)}
              style={styles.imageMessageContainer}
            >
              <Image
                source={{ uri: item.image_url }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <Text
              style={[
                styles.messageText,
                isMe ? styles.messageTextMe : styles.messageTextOther,
              ]}
            >
              {item.message}
            </Text>
          )}

          <Text
            style={[
              styles.messageTime,
              isMe ? styles.messageTimeMe : styles.messageTimeOther,
              isImage && styles.messageTimeImage,
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {!isConnected && (
        <View style={styles.connectionBanner}>
          <Ionicons name="wifi-outline" size={14} color="#fff" />
          <Text style={styles.connectionText}>Connecting...</Text>
        </View>
      )}

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/(driver)/messages")}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          {chatParticipant?.image ? (
            <Image
              source={{ uri: chatParticipant.image }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarInitials}>
                {chatParticipant?.name?.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}

          <View style={styles.headerText}>
            <Text style={styles.headerName}>
              {chatParticipant?.name || "Chat"}
            </Text>

            <View style={styles.participantTypeContainer}>
              <View
                style={[
                  styles.participantTypeBadge,
                  {
                    backgroundColor:
                      chatParticipant?.type === "customer"
                        ? "#10B98120"
                        : "#FF6B3520",
                  },
                ]}
              >
                <Ionicons
                  name={
                    chatParticipant?.type === "customer"
                      ? "person-outline"
                      : "restaurant-outline"
                  }
                  size={10}
                  color={
                    chatParticipant?.type === "customer" ? "#10B981" : "#FF6B35"
                  }
                />
                <Text
                  style={[
                    styles.participantTypeText,
                    {
                      color:
                        chatParticipant?.type === "customer"
                          ? "#10B981"
                          : "#FF6B35",
                    },
                  ]}
                >
                  {chatParticipant?.type === "customer"
                    ? "CUSTOMER"
                    : "RESTAURANT"}
                </Text>
              </View>
            </View>

            {(orderId || orderDetails) && (
              <View style={styles.orderInfo}>
                <Ionicons name="receipt-outline" size={12} color="#FF6B35" />
                <Text style={styles.orderNumberText}>
                  Order #
                  {orderNumber ||
                    orderDetails?.order_number ||
                    orderId?.slice(-6)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          {chatParticipant?.phone && (
            <TouchableOpacity
              style={[styles.headerAction, styles.callAction]}
              onPress={handleCall}
            >
              <Ionicons name="call-outline" size={18} color="#10B981" />
            </TouchableOpacity>
          )}

          {(orderId || orderDetails) && (
            <TouchableOpacity
              style={[styles.headerAction, styles.orderAction]}
              onPress={handleViewOrder}
            >
              <Ionicons name="restaurant-outline" size={18} color="#FF6B35" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Order Info Bar */}
      {orderDetails && (
        <Animated.View
          style={[
            styles.orderInfoBar,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.orderInfoItem}>
            <Ionicons name="bicycle" size={14} color="#FF6B35" />
            <Text style={styles.orderInfoText}>
              Status: {orderDetails.status?.replace("_", " ").toUpperCase()}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Messages List with Refresh Control */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshChat}
            colors={["#FF6B35"]}
            tintColor="#FF6B35"
            title="Refreshing..."
            titleColor="#6B7280"
          />
        }
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <Animated.View
          style={[
            styles.inputContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={showImageOptions}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color="#FF6B35" />
            ) : (
              <Ionicons name="camera-outline" size={24} color="#6B7280" />
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={`Message ${chatParticipant?.type === "customer" ? "customer" : "restaurant"}...`}
            placeholderTextColor="#9CA3AF"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />

          {newMessage.trim() ? (
            <Animated.View style={{ transform: [{ scale: sendAnim }] }}>
              <TouchableOpacity
                style={[styles.sendButton, sending && styles.sendButtonSending]}
                onPress={sendMessage}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  connectionBanner: {
    backgroundColor: "#F59E0B",
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  connectionText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerAvatarInitials: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  participantTypeContainer: {
    marginTop: 2,
    marginBottom: 4,
  },
  participantTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  participantTypeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  orderInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  orderNumberText: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  callAction: {
    backgroundColor: "#D1FAE5",
  },
  orderAction: {
    backgroundColor: "#FFEDD5",
  },
  orderInfoBar: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  orderInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderInfoText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: "row",
    marginVertical: 6,
    alignItems: "flex-end",
  },
  messageContainerMe: {
    justifyContent: "flex-end",
  },
  messageContainerOther: {
    justifyContent: "flex-start",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 8,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 14,
  },
  messageBubbleMe: {
    backgroundColor: "#FF6B35",
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: "#F8FAFC",
    borderBottomLeftRadius: 4,
    borderWidth: 0.4,
    borderColor: "#E2E8F0",
  },
  senderName: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "600",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextMe: {
    color: "#fff",
  },
  messageTextOther: {
    color: "#111827",
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeMe: {
    color: "rgba(255,255,255,0.7)",
  },
  messageTimeOther: {
    color: "#9CA3AF",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.6,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#F1F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 20,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonSending: {
    backgroundColor: "#FDBA74",
  },
  cameraButton: {
    width: 42,
    height: 42,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginVertical: 4,
  },
  messageBubbleImage: {
    backgroundColor: "transparent",
    padding: 0,
    maxWidth: "70%",
  },
  imageMessageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  messageTimeImage: {
    color: "#374151",
    marginTop: 4,
    fontWeight: "500",
  },
});
