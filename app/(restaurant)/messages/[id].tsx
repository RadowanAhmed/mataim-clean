// app/(restaurant)/messages/[id].tsx - FIXED

import { useAuth } from "@/backend/AuthContext";
import { NotificationService } from "@/backend/services/notificationService";
import { supabase } from "@/backend/supabase";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
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

export default function RestaurantChatScreen() {
  const { id } = useLocalSearchParams();
  // These might be passed from navigation
  const customerId = params.customerId as string;
  const driverId = params.driverId as string;
  const customerName = params.customerName as string;
  const driverName = params.driverName as string;

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
    type: "customer" | "driver";
    name: string;
    image: string | null;
    phone: string | null;
    email: string | null;
    vehicleType?: string | null;
    rating?: number | null;
    totalDeliveries?: number | null;
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
        "🍽️ Restaurant chat screen focused - refreshing data for ID:",
        id,
      );
      if (id && user?.id) {
        refreshChat();
      }
      return () => {
        console.log("🍽️ Restaurant chat screen unfocused");
      };
    }, [id, user?.id]),
  );

  // Real-time subscription
  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    const setupRealtime = async () => {
      if (!id || !user?.id) return;

      try {
        if (channel) {
          supabase.removeChannel(channel);
        }

        channel = supabase
          .channel(`restaurant-messages-${id}`)
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

              console.log(
                "📱 RESTAURANT REAL-TIME: New message:",
                payload.new.id,
              );

              if (payload.new.sender_id === user.id) return;

              // Only add messages from our chat participant
              const participantId = chatParticipant?.id;
              if (participantId && payload.new.sender_id !== participantId) {
                console.log(
                  "Ignoring message from other participant:",
                  payload.new.sender_id,
                );
                return;
              }

              const { data: completeMessage, error } = await supabase
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

              if (error) {
                console.error("Error fetching new message:", error);
                return;
              }

              // Create animation for new message
              messageAnims[completeMessage.id] = new Animated.Value(0);

              setMessages((prev) => {
                const exists = prev.some(
                  (msg) => msg.id === completeMessage.id,
                );
                if (!exists) {
                  return [...prev, completeMessage];
                }
                return prev;
              });

              // Animate new message
              Animated.spring(messageAnims[completeMessage.id], {
                toValue: 1,
                friction: 5,
                tension: 40,
                useNativeDriver: true,
              }).start();

              markMessagesAsRead();

              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            },
          )
          .subscribe((status) => {
            console.log("📡 Restaurant real-time status:", status);
            setIsConnected(status === "SUBSCRIBED");
          });
      } catch (error) {
        console.error("Error setting up restaurant real-time:", error);
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

      loadChatData();
    }
  }, [id, user?.id]);

  const refreshChat = async () => {
    console.log("🔄 Refreshing restaurant chat data for ID:", id);
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
      Object.keys(messageAnims).forEach((key) => delete messageAnims[key]);

      await fetchConversation();
      // Pass IDs from params as fallback
      await fetchMessages(customerId || driverId);
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

      const query = supabase
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
            phone,
            email
          ),
          driver:delivery_users!conversations_driver_id_fkey(
            id,
            users!delivery_users_id_fkey(
              id,
              full_name,
              profile_image_url,
              phone,
              email
            ),
            vehicle_type,
            rating,
            total_deliveries,
            is_online
          )
        `,
        )
        .eq("id", id)
        .single();

      const { data, error } = await query;

      if (error) throw error;

      console.log("Conversation data refreshed:", data.id);
      setConversation(data);

      // Determine who we're chatting with (customer or driver)
      if (data.customer_id) {
        setChatParticipant({
          id: data.customer_id,
          type: "customer",
          name: data.customer?.full_name || "Customer",
          image: data.customer?.profile_image_url || null,
          phone: data.customer?.phone || null,
          email: data.customer?.email || null,
        });
      } else if (data.driver_id) {
        setChatParticipant({
          id: data.driver_id,
          type: "driver",
          name: data.driver?.users?.full_name || "Driver",
          image: data.driver?.users?.profile_image_url || null,
          phone: data.driver?.users?.phone || null,
          email: data.driver?.users?.email || null,
          vehicleType: data.driver?.vehicle_type || null,
          rating: data.driver?.rating || null,
          totalDeliveries: data.driver?.total_deliveries || null,
        });
      }
    } catch (error) {
      console.error("Error fetching conversation:", error);
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
        conversation?.customer_id ||
        conversation?.driver_id ||
        customerId ||
        driverId;

      const filteredMessages = (data || []).filter(
        (msg) =>
          msg.sender_id === user?.id ||
          (otherPartyId && msg.sender_id === otherPartyId),
      );

      setMessages(filteredMessages);

      // Create animation values
      filteredMessages.forEach((msg: any) => {
        if (!messageAnims[msg.id]) {
          messageAnims[msg.id] = new Animated.Value(0);
        }
      });

      // Animate messages
      Animated.stagger(
        50,
        filteredMessages.map((_: any, index: number) =>
          Animated.timing(messageAnims[filteredMessages[index].id], {
            toValue: 1,
            duration: 300,
            delay: index * 50,
            useNativeDriver: true,
          }),
        ),
      ).start();

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

    try {
      setSending(true);
      animateMessageSend();

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        conversation_id: id,
        sender_id: user.id,
        message: newMessage.trim(),
        message_type: "text",
        is_read: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: {
          id: user.id,
          full_name: user.full_name || "You",
          profile_image_url: user.profile_image_url,
        },
        isOptimistic: true,
      };

      // Create animation for optimistic message
      messageAnims[tempId] = new Animated.Value(0);

      setMessages((prev) => [...prev, optimisticMessage]);
      setNewMessage("");

      // Animate optimistic message
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
          conversation_id: id,
          sender_id: user.id,
          message: newMessage.trim(),
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

      if (error) {
        console.error("Database error:", error);
        throw error;
      }

      console.log("Message saved to database:", data.id);

      await supabase
        .from("conversations")
        .update({
          last_message: newMessage.trim(),
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      // Send notification to the correct participant
      if (chatParticipant) {
        await NotificationService.sendMessageNotification(
          id as string,
          user.id,
          newMessage.trim(),
          user.full_name || "Restaurant",
          "restaurant",
          chatParticipant.id,
          chatParticipant.type,
        );
      }

      // Replace optimistic message with real message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId ? { ...data, is_read: true } : msg,
        ),
      );

      // Transfer animation to real message
      messageAnims[data.id] = messageAnims[tempId];
      delete messageAnims[tempId];
    } catch (error: any) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-")));
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const animateMessageSend = () => {
    Animated.sequence([
      Animated.timing(sendAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(sendAnim, {
        toValue: 1,
        tension: 150,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleEmail = () => {
    if (!chatParticipant?.email) {
      Alert.alert("Error", "Email not available");
      return;
    }

    Linking.openURL(`mailto:${chatParticipant.email}`).catch(() => {
      Alert.alert("Error", "Unable to send email");
    });
  };

  const handleViewProfile = () => {
    if (chatParticipant?.type === "customer" && chatParticipant?.id) {
      router.push(`/(restaurant)/customers/${chatParticipant.id}`);
    }
  };

  const handleCall = async () => {
    if (!chatParticipant?.phone) {
      Alert.alert("Error", "Phone number not available");
      return;
    }

    Linking.openURL(`tel:${chatParticipant.phone}`);
  };

  const renderParticipantBadge = () => {
    if (!chatParticipant) return null;

    return (
      <View
        style={[
          styles.participantBadge,
          {
            backgroundColor:
              chatParticipant.type === "customer" ? "#10B98120" : "#8B5CF620",
          },
        ]}
      >
        <Ionicons
          name={
            chatParticipant.type === "customer"
              ? "person-outline"
              : "bicycle-outline"
          }
          size={10}
          color={chatParticipant.type === "customer" ? "#10B981" : "#8B5CF6"}
        />
        <Text
          style={[
            styles.participantBadgeText,
            {
              color:
                chatParticipant.type === "customer" ? "#10B981" : "#8B5CF6",
            },
          ]}
        >
          {chatParticipant.type === "customer" ? "CUSTOMER" : "DRIVER"}
        </Text>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === user?.id;
    const isOptimistic = item.isOptimistic;
    const isImage = item.message_type === "image" && item.image_url;

    // Get current other party ID from multiple sources
    const currentOtherPartyId =
      chatParticipant?.id ||
      conversation?.customer_id ||
      conversation?.driver_id ||
      customerId ||
      driverId;

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
        {!isMe && item.sender?.profile_image_url && !isImage && (
          <TouchableOpacity
            onPress={
              chatParticipant?.type === "customer"
                ? handleViewProfile
                : undefined
            }
            activeOpacity={0.6}
          >
            <Image
              source={{ uri: item.sender.profile_image_url }}
              style={styles.messageAvatar}
            />
          </TouchableOpacity>
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
            <TouchableOpacity
              onPress={
                chatParticipant?.type === "customer"
                  ? handleViewProfile
                  : undefined
              }
              activeOpacity={0.6}
            >
              <Text style={styles.senderName}>
                {chatParticipant?.type === "customer" ? "Customer" : "Driver"}
              </Text>
            </TouchableOpacity>
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
              {isOptimistic && <Text style={styles.typingIndicator}> ●●●</Text>}
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
                  color="rgba(255,255,255,0.8)"
                  style={styles.readIcon}
                />
              )}
            </View>
          )}
        </View>

        {isMe && item.sender?.profile_image_url && !isImage && (
          <Image
            source={{ uri: item.sender.profile_image_url }}
            style={styles.messageAvatar}
          />
        )}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Animated.View
          style={{
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
            transform: [
              {
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          }}
        >
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Connection Status */}
      {!isConnected && (
        <View style={styles.connectionBanner}>
          <Ionicons name="wifi-outline" size={14} color="#fff" />
          <Text style={styles.connectionText}>Connecting...</Text>
        </View>
      )}

      {/* Header */}
      <Animated.View style={[styles.header]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/(restaurant)/messages")}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={
            chatParticipant?.type === "customer" ? handleViewProfile : undefined
          }
          activeOpacity={chatParticipant?.type === "customer" ? 0.6 : 1}
        >
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
            {renderParticipantBadge()}
            <View style={styles.headerStatusContainer}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? "#10B981" : "#9CA3AF" },
                ]}
              />
              <Text style={styles.headerStatus}>
                {isConnected ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {chatParticipant?.phone && (
            <TouchableOpacity
              style={[styles.headerAction, styles.callAction]}
              onPress={handleCall}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={18} color="#10B981" />
            </TouchableOpacity>
          )}

          {chatParticipant?.email && (
            <TouchableOpacity
              style={[styles.headerAction, styles.emailAction]}
              onPress={handleEmail}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={18} color="#3B82F6" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Info Bar - Shows participant info */}
      <View>
        <Animated.ScrollView
          style={styles.customerInfoBar}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
        >
          {chatParticipant?.type === "customer" ? (
            <>
              <TouchableOpacity
                style={styles.customerInfoItem}
                onPress={handleViewProfile}
                activeOpacity={0.6}
              >
                <MaterialIcons
                  name="person-outline"
                  size={14}
                  color="#FF6B35"
                />
                <Text style={styles.customerInfoText}>
                  {chatParticipant.name}
                </Text>
                <Ionicons name="open-outline" size={12} color="#FF6B35" />
              </TouchableOpacity>

              {chatParticipant.phone && (
                <TouchableOpacity
                  style={styles.customerInfoItem}
                  onPress={handleCall}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="phone" size={14} color="#10B981" />
                  <Text style={[styles.customerInfoText, styles.phoneText]}>
                    {chatParticipant.phone}
                  </Text>
                  <Ionicons name="call-outline" size={12} color="#10B981" />
                </TouchableOpacity>
              )}

              {chatParticipant.email && (
                <TouchableOpacity
                  style={styles.customerInfoItem}
                  onPress={handleEmail}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="email" size={14} color="#3B82F6" />
                  <Text style={[styles.customerInfoText, styles.emailText]}>
                    {chatParticipant.email}
                  </Text>
                  <Ionicons name="mail-outline" size={12} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </>
          ) : chatParticipant?.type === "driver" ? (
            <>
              <View style={styles.customerInfoItem}>
                <MaterialIcons
                  name="person-outline"
                  size={14}
                  color="#8B5CF6"
                />
                <Text style={styles.customerInfoText}>
                  {chatParticipant.name}
                </Text>
              </View>

              {chatParticipant.vehicleType && (
                <View style={styles.customerInfoItem}>
                  <MaterialIcons
                    name="directions-car"
                    size={14}
                    color="#8B5CF6"
                  />
                  <Text style={styles.customerInfoText}>
                    {chatParticipant.vehicleType}
                  </Text>
                </View>
              )}

              {chatParticipant.rating && (
                <View style={styles.customerInfoItem}>
                  <MaterialIcons name="star" size={14} color="#FFD700" />
                  <Text style={styles.customerInfoText}>
                    {chatParticipant.rating.toFixed(1)} ★
                  </Text>
                </View>
              )}

              {chatParticipant.totalDeliveries && (
                <View style={styles.customerInfoItem}>
                  <MaterialIcons
                    name="delivery-dining"
                    size={14}
                    color="#8B5CF6"
                  />
                  <Text style={styles.customerInfoText}>
                    {chatParticipant.totalDeliveries} deliveries
                  </Text>
                </View>
              )}

              {chatParticipant.phone && (
                <TouchableOpacity
                  style={styles.customerInfoItem}
                  onPress={handleCall}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="phone" size={14} color="#10B981" />
                  <Text style={[styles.customerInfoText, styles.phoneText]}>
                    {chatParticipant.phone}
                  </Text>
                  <Ionicons name="call-outline" size={12} color="#10B981" />
                </TouchableOpacity>
              )}

              {chatParticipant.email && (
                <TouchableOpacity
                  style={styles.customerInfoItem}
                  onPress={handleEmail}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="email" size={14} color="#3B82F6" />
                  <Text style={[styles.customerInfoText, styles.emailText]}>
                    {chatParticipant.email}
                  </Text>
                  <Ionicons name="mail-outline" size={12} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </>
          ) : null}
        </Animated.ScrollView>
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
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder={`Message ${chatParticipant?.type === "customer" ? "customer" : "driver"}...`}
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
              activeOpacity={0.8}
            >
              <Animated.View
                style={{
                  transform: [{ scale: sendAnim }],
                }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </Animated.View>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
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
    borderBottomColor: "#F3F4F6",
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
    borderWidth: 2,
    borderColor: "#FF6B35",
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
  headerStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerStatus: {
    fontSize: 12,
    color: "#6B7280",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  callAction: {
    backgroundColor: "#D1FAE5",
  },
  emailAction: {
    backgroundColor: "#DBEAFE",
  },
  customerInfoBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    paddingBottom: 4,
  },
  customerInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 0.6,
    borderColor: "#E5E7EB",
    marginRight: 6,
    gap: 4,
  },
  customerInfoText: {
    fontSize: 12,
    color: "#6B7280",
  },
  phoneText: {
    color: "#10B981",
  },
  emailText: {
    color: "#3B82F6",
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
    padding: 12,
    borderRadius: 14,
  },
  messageBubbleMe: {
    backgroundColor: "#FF6B35",
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: "#F8FAFC",
    borderBottomLeftRadius: 4,
    borderWidth: 0.6,
    borderColor: "#E2E8F0",
  },
  optimisticBubble: {
    opacity: 0.8,
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
  typingIndicator: {
    fontSize: 24,
    color: "#fff",
    lineHeight: 15,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.6,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 22,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonSending: {
    backgroundColor: "#FDBA74",
  },
  participantBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
    marginTop: 2,
  },
  participantBadgeText: {
    fontSize: 9,
    fontWeight: "600",
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
