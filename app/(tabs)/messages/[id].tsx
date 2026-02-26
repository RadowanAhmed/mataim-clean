// app/(tabs)/messages/[id].tsx - FIXED

import { useAuth } from "@/backend/AuthContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const id = params.id as string;

  // Extract all possible params that might be passed
  const restaurantId = params.restaurantId as string;
  const driverId = params.driverId as string;
  const restaurantName = params.restaurantName as string;
  const driverName = params.driverName as string;
  const restaurantImage = params.restaurantImage as string;
  const driverImage = params.driverImage as string;
  const orderId = params.orderId as string;

  const router = useRouter();
  const { user } = useAuth();

  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Track the specific participant we're chatting with
  const [chatParticipant, setChatParticipant] = useState<{
    id: string;
    type: "restaurant" | "driver";
    name: string;
    image: string | null;
    phone: string | null;
  } | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Use useFocusEffect to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("📱 Chat screen focused - refreshing data for ID:", id);
      if (id && user?.id) {
        refreshChat();
      }
      return () => {
        console.log("📱 Chat screen unfocused");
      };
    }, [id, user?.id]),
  );

  // Real-time connection
  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const setupRealtime = async () => {
      if (!id || !user?.id) return;

      try {
        if (channel) {
          supabase.removeChannel(channel);
        }

        channel = supabase
          .channel(`messages-${id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${id}`,
            },
            async (payload) => {
              if (!mounted) return;

              // Skip if it's our own message
              if (payload.new.sender_id === user.id) return;

              // Only add messages from our chat participant (using current participant or fetch)
              const participantId = chatParticipant?.id;
              if (participantId && payload.new.sender_id !== participantId) {
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
                setMessages((prev) => {
                  const exists = prev.some(
                    (msg) => msg.id === completeMessage.id,
                  );
                  if (!exists) {
                    return [...prev, completeMessage];
                  }
                  return prev;
                });

                markMessagesAsRead();

                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }
            },
          )
          .subscribe((status) => {
            setIsConnected(status === "SUBSCRIBED");

            if (status === "CHANNEL_ERROR" || status === "CLOSED") {
              if (retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(() => {
                  if (mounted) setupRealtime();
                }, 2000 * retryCount);
              }
            } else if (status === "SUBSCRIBED") {
              retryCount = 0;
            }
          });
      } catch (error) {
        console.error("Error setting up real-time:", error);
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [id, user?.id, chatParticipant?.id]);

  // Initial load
  useEffect(() => {
    if (id && user?.id) {
      loadChatData();
    }
  }, [id, user?.id]);

  const refreshChat = async () => {
    console.log("🔄 Refreshing chat data for ID:", id);
    setRefreshing(true);
    await loadChatData(true);
    setRefreshing(false);
  };

  const loadChatData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      // Reset for new chat
      setMessages([]);
      setChatParticipant(null);

      await fetchConversation();
      // Pass IDs from params as fallback
      await fetchMessages(restaurantId || driverId);
      await markMessagesAsRead();
    } catch (error) {
      console.error("Error loading chat data:", error);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  };

  const fetchConversation = async () => {
    try {
      console.log("Fetching conversation with ID:", id);

      const { data, error } = await supabase
        .from("conversations")
        .select(
          `
          *,
          customer:users!conversations_customer_id_fkey(
            id,
            full_name,
            profile_image_url,
            user_type,
            phone
          ),
          restaurant:restaurants!conversations_restaurant_id_fkey(
            id,
            restaurant_name,
            image_url,
            address
          ),
          driver:delivery_users!conversations_driver_id_fkey(
            id,
            users!inner(
              id,
              full_name,
              profile_image_url,
              phone
            ),
            vehicle_type,
            rating
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      console.log("Conversation data refreshed:", data.id);
      setConversation(data);

      // Determine who we're talking to as a customer
      if (user?.user_type === "customer") {
        if (data.restaurant_id) {
          // Chatting with restaurant - get restaurant owner's phone
          let restaurantPhone = null;
          const { data: restaurantOwner } = await supabase
            .from("users")
            .select("phone")
            .eq("id", data.restaurant_id)
            .single();

          if (restaurantOwner) {
            restaurantPhone = restaurantOwner.phone;
          }

          setChatParticipant({
            id: data.restaurant_id,
            type: "restaurant",
            name: data.restaurant?.restaurant_name || "Restaurant",
            image: data.restaurant?.image_url || null,
            phone: restaurantPhone,
          });
        } else if (data.driver_id) {
          // Chatting with driver
          setChatParticipant({
            id: data.driver_id,
            type: "driver",
            name: data.driver?.users?.full_name || "Driver",
            image: data.driver?.users?.profile_image_url || null,
            phone: data.driver?.users?.phone || null,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching conversation:", error);
      Alert.alert("Error", "Failed to load conversation");
    }
  };

  const fetchMessages = async (fallbackParticipantId?: string) => {
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
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Use passed ID, or chatParticipant, or conversation data, or params
      let otherPartyId =
        fallbackParticipantId ||
        chatParticipant?.id ||
        conversation?.restaurant_id ||
        conversation?.driver_id ||
        restaurantId ||
        driverId;

      const filteredMessages = (data || []).filter(
        (msg) =>
          msg.sender_id === user?.id ||
          (otherPartyId && msg.sender_id === otherPartyId),
      );

      setMessages(filteredMessages);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user?.id || !id) return;

    try {
      const { error } = await supabase.rpc(
        "mark_conversation_messages_as_read",
        {
          p_conversation_id: id,
          p_user_id: user.id,
        },
      );

      if (error) console.error("Error marking messages as read:", error);
    } catch (error) {
      console.error("Error in markMessagesAsRead:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !id || sending || !chatParticipant)
      return;

    const messageText = newMessage.trim();

    try {
      setSending(true);

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        conversation_id: id,
        sender_id: user.id,
        message: messageText,
        message_type: "text",
        is_read: true,
        created_at: new Date().toISOString(),
        sender: {
          id: user.id,
          full_name: user.full_name || "You",
          profile_image_url: user.profile_image_url,
        },
        isOptimistic: true,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setNewMessage("");

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: id,
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
        .eq("id", id);

      // Send notification to the correct participant
      if (chatParticipant) {
        await NotificationService.sendMessageNotification(
          id as string,
          user.id,
          messageText,
          user.full_name || "Customer",
          "customer",
          chatParticipant.id,
          chatParticipant.type,
        );
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...data, is_read: true } : msg,
        ),
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) =>
        prev.filter((msg) => !msg.id.toString().startsWith("temp-")),
      );
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleCall = async () => {
    if (!chatParticipant?.phone) {
      Alert.alert("Error", "Phone number not available");
      return;
    }

    Linking.openURL(`tel:${chatParticipant.phone}`).catch(() => {
      Alert.alert("Error", "Unable to make phone call");
    });
  };

  const getOtherPartyName = () => {
    return chatParticipant?.name || "Chat";
  };

  const getOtherPartyImage = () => {
    return chatParticipant?.image || null;
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === user?.id;
    const isOptimistic = item.isOptimistic;
    const isImage = item.message_type === "image" && item.image_url;

    // Get current other party ID from multiple sources
    const currentOtherPartyId =
      chatParticipant?.id ||
      conversation?.restaurant_id ||
      conversation?.driver_id ||
      restaurantId ||
      driverId;

    if (!isMe && item.sender_id !== currentOtherPartyId) {
      return null;
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.messageContainerMe : styles.messageContainerOther,
        ]}
      >
        {!isMe && item.sender?.profile_image_url && !isImage && (
          <Image
            source={{ uri: item.sender.profile_image_url }}
            style={styles.messageAvatar}
          />
        )}

        <View
          style={[
            styles.messageBubble,
            isImage && styles.messageBubbleImage, // Special style for image bubbles
            !isImage && isMe && styles.messageBubbleMe,
            !isImage && !isMe && styles.messageBubbleOther,
            isOptimistic && styles.optimisticBubble,
          ]}
        >
          {!isMe && !isImage && !isOptimistic && (
            <Text style={styles.senderName}>
              {chatParticipant?.type === "restaurant" ? "Restaurant" : "Driver"}
            </Text>
          )}

          {/* Render image if it's an image message */}
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

          {!isOptimistic && (
            <View style={styles.messageFooter}>
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
              {item.is_read && isMe && (
                <Ionicons
                  name="checkmark-done"
                  size={12}
                  color="rgba(255,255,255,0.7)"
                  style={styles.readIcon}
                />
              )}
            </View>
          )}
        </View>
      </View>
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          {getOtherPartyImage() ? (
            <Image
              source={{ uri: getOtherPartyImage() }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarInitials}>
                {getOtherPartyName().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.headerName}>{getOtherPartyName()}</Text>

            {/* Show participant type badge */}
            <View style={styles.participantTypeContainer}>
              <View
                style={[
                  styles.participantTypeBadge,
                  {
                    backgroundColor:
                      chatParticipant?.type === "restaurant"
                        ? "#FF6B3520"
                        : "#8B5CF620",
                  },
                ]}
              >
                <Ionicons
                  name={
                    chatParticipant?.type === "restaurant"
                      ? "restaurant-outline"
                      : "bicycle-outline"
                  }
                  size={10}
                  color={
                    chatParticipant?.type === "restaurant"
                      ? "#FF6B35"
                      : "#8B5CF6"
                  }
                />
                <Text
                  style={[
                    styles.participantTypeText,
                    {
                      color:
                        chatParticipant?.type === "restaurant"
                          ? "#FF6B35"
                          : "#8B5CF6",
                    },
                  ]}
                >
                  {chatParticipant?.type === "restaurant"
                    ? "RESTAURANT"
                    : "DRIVER"}
                </Text>
              </View>
            </View>

            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: isConnected ? "#10B981" : "#9CA3AF" },
                ]}
              />
              <Text style={styles.headerStatus}>
                {isConnected ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
        </View>

        {chatParticipant?.phone && (
          <TouchableOpacity style={styles.headerAction} onPress={handleCall}>
            <Ionicons name="call-outline" size={20} color="#FF6B35" />
          </TouchableOpacity>
        )}
      </View>

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
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={`Message ${chatParticipant?.type === "restaurant" ? "restaurant" : "driver"}...`}
            placeholderTextColor="#9CA3AF"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />

          {newMessage.trim() ? (
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
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  connectionBanner: {
    backgroundColor: "#F59E0B",
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  connectionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#fff",
  },
  backButton: { padding: 8 },
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
  headerText: { flex: 1 },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  participantTypeContainer: {
    marginTop: 2,
    marginBottom: 2,
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
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  headerStatus: {
    fontSize: 12,
    color: "#6B7280",
  },
  headerAction: {
    padding: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  messageContainer: {
    flexDirection: "row",
    marginVertical: 4,
    alignItems: "flex-end",
  },
  messageContainerMe: {
    justifyContent: "flex-end",
  },
  messageContainerOther: {
    justifyContent: "flex-start",
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 6,
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
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  optimisticBubble: {
    opacity: 0.7,
  },
  senderName: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 2,
    fontWeight: "600",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
  },
  messageTextMe: {
    color: "#fff",
  },
  messageTextOther: {
    color: "#111827",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 2,
  },
  messageTime: {
    fontSize: 10,
  },
  messageTimeMe: {
    color: "rgba(255,255,255,0.7)",
  },
  messageTimeOther: {
    color: "#9CA3AF",
  },
  readIcon: {
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 0.6,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginVertical: 4,
  },
  messageTimeImage: {
    color: "#374151",
    marginTop: 4,
    fontWeight: "500",
  },
});
