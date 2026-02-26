// app/(restaurant)/payments/index.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface PaymentMethod {
  id: string;
  user_id: string;
  type: string;
  provider: string | null;
  card_last_four: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BankAccount {
  id: string;
  restaurant_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  iban: string;
  swift_code: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  order_id: string;
  amount: number;
  status: "pending" | "completed" | "failed" | "refunded";
  payment_method: string;
  transaction_id: string;
  created_at: string;
  orders: {
    order_number: string;
    final_amount: number;
  };
}

export default function PaymentSetupScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("methods"); // 'methods', 'bank', 'transactions'

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsHasMore, setTransactionsHasMore] = useState(true);

  // Modals
  const [showBankModal, setShowBankModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);

  // Bank form
  const [bankForm, setBankForm] = useState({
    account_holder_name: "",
    bank_name: "",
    account_number: "",
    iban: "",
    swift_code: "",
    is_default: false,
  });

  const [submitting, setSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total_earnings: 0,
    pending_payouts: 0,
    completed_payouts: 0,
    total_transactions: 0,
  });

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const fetchPaymentData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Fetch payment methods
      const { data: methodsData, error: methodsError } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at");

      if (methodsError) throw methodsError;

      // If no methods exist, create default ones
      if (!methodsData || methodsData.length === 0) {
        await createDefaultPaymentMethods();
      } else {
        setPaymentMethods(methodsData);
      }

      // Fetch bank accounts
      const { data: bankData, error: bankError } = await supabase
        .from("restaurant_bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (bankError) throw bankError;
      setBankAccounts(bankData || []);

      // Fetch transaction stats
      await fetchTransactionStats();

      // Fetch recent transactions
      await fetchTransactions(1, true);
    } catch (error) {
      console.error("Error fetching payment data:", error);
      Alert.alert("Error", "Failed to load payment settings");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const createDefaultPaymentMethods = async () => {
    if (!user?.id) return;

    const defaultMethods = [
      {
        user_id: user.id,
        type: "cash_on_delivery",
        provider: "Cash",
        is_default: true,
        is_active: true,
      },
      {
        user_id: user.id,
        type: "credit_card",
        provider: "Card",
        is_default: false,
        is_active: true,
      },
      {
        user_id: user.id,
        type: "digital_wallet",
        provider: "Digital Wallet",
        is_default: false,
        is_active: false,
      },
      {
        user_id: user.id,
        type: "debit_card",
        provider: "Debit Card",
        is_default: false,
        is_active: false,
      },
    ];

    const { data, error } = await supabase
      .from("payment_methods")
      .insert(defaultMethods)
      .select();

    if (error) {
      console.error("Error creating default payment methods:", error);
    } else {
      setPaymentMethods(data || []);
    }
  };

  const fetchTransactionStats = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("final_amount, payment_status")
        .eq("restaurant_id", user.id)
        .in("payment_status", ["completed", "pending"]);

      if (error) throw error;

      const stats = {
        total_earnings: 0,
        pending_payouts: 0,
        completed_payouts: 0,
        total_transactions: data?.length || 0,
      };

      data?.forEach((order) => {
        if (order.payment_status === "completed") {
          stats.total_earnings += order.final_amount;
          stats.completed_payouts++;
        } else if (order.payment_status === "pending") {
          stats.pending_payouts += order.final_amount;
        }
      });

      setStats(stats);
    } catch (error) {
      console.error("Error fetching transaction stats:", error);
    }
  };

  const fetchTransactions = async (
    page: number = 1,
    reset: boolean = false,
  ) => {
    if (!user?.id) return;

    try {
      setTransactionsLoading(true);

      const from = (page - 1) * 10;
      const to = from + 9;

      const { data, error, count } = await supabase
        .from("orders")
        .select(
          `
        id,
        order_number,
        final_amount,
        payment_method,
        payment_status,
        created_at
      `,
          { count: "exact" },
        )
        .eq("restaurant_id", user.id)
        .not("payment_status", "eq", "pending")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const transformed = (data || []).map((item) => ({
        id: item.id,
        order_id: item.id,
        amount: item.final_amount,
        status: item.payment_status,
        payment_method: item.payment_method,
        transaction_id: `TXN-${item.order_number}`, // Generate from order_number
        created_at: item.created_at,
        orders: {
          order_number: item.order_number,
          final_amount: item.final_amount,
        },
      }));

      setTransactions((prev) =>
        reset ? transformed : [...prev, ...transformed],
      );
      setTransactionsHasMore((data?.length || 0) === 10);
      setTransactionsPage(page);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const togglePaymentMethod = async (method: PaymentMethod) => {
    try {
      const newStatus = !method.is_active;

      const { error } = await supabase
        .from("payment_methods")
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", method.id);

      if (error) throw error;

      setPaymentMethods((prev) =>
        prev.map((m) =>
          m.id === method.id ? { ...m, is_active: newStatus } : m,
        ),
      );

      Alert.alert(
        "Success",
        `${method.type.replace(/_/g, " ")} ${newStatus ? "enabled" : "disabled"} successfully`,
      );
    } catch (error) {
      console.error("Error toggling payment method:", error);
      Alert.alert("Error", "Failed to update payment method");
    }
  };

  const updatePaymentMethodSettings = async (
    methodId: string,
    updates: Partial<PaymentMethod>,
  ) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", methodId);

      if (error) throw error;

      setPaymentMethods((prev) =>
        prev.map((m) => (m.id === methodId ? { ...m, ...updates } : m)),
      );

      Alert.alert("Success", "Payment method updated successfully");
    } catch (error) {
      console.error("Error updating payment method:", error);
      Alert.alert("Error", "Failed to update payment method");
    }
  };

  const handleSaveBank = async () => {
    if (!user?.id) return;

    // Validation
    if (!bankForm.account_holder_name.trim()) {
      Alert.alert("Error", "Please enter account holder name");
      return;
    }
    if (!bankForm.bank_name.trim()) {
      Alert.alert("Error", "Please enter bank name");
      return;
    }
    if (!bankForm.account_number.trim()) {
      Alert.alert("Error", "Please enter account number");
      return;
    }

    try {
      setSubmitting(true);

      const bankData = {
        user_id: user.id, // Change from restaurant_id to user_id
        account_holder_name: bankForm.account_holder_name,
        bank_name: bankForm.bank_name,
        account_number: bankForm.account_number,
        iban: bankForm.iban || null,
        swift_code: bankForm.swift_code || null,
        is_default: bankForm.is_default,
        updated_at: new Date().toISOString(),
      };

      let result;

      if (editingBank) {
        // Update existing
        result = await supabase
          .from("restaurant_bank_accounts")
          .update(bankData)
          .eq("id", editingBank.id);
      } else {
        // Create new
        bankData.created_at = new Date().toISOString();
        result = await supabase
          .from("restaurant_bank_accounts")
          .insert([bankData])
          .select();
      }

      if (result.error) throw result.error;

      // If this is set as default, update other accounts
      if (bankForm.is_default) {
        await supabase
          .from("restaurant_bank_accounts")
          .update({ is_default: false })
          .eq("user_id", user.id)
          .neq("id", editingBank?.id || result.data?.[0]?.id);
      }

      Alert.alert(
        "Success",
        `Bank account ${editingBank ? "updated" : "added"} successfully`,
      );

      // Reset form and close modal
      resetBankForm();
      setShowBankModal(false);

      // Refresh bank accounts
      fetchPaymentData();
    } catch (error) {
      console.error("Error saving bank account:", error);
      Alert.alert("Error", "Failed to save bank account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBank = (bankId: string) => {
    Alert.alert(
      "Delete Bank Account",
      "Are you sure you want to delete this bank account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("restaurant_bank_accounts")
                .delete()
                .eq("id", bankId);

              if (error) throw error;

              setBankAccounts((prev) => prev.filter((b) => b.id !== bankId));
              Alert.alert("Success", "Bank account deleted successfully");
            } catch (error) {
              console.error("Error deleting bank account:", error);
              Alert.alert("Error", "Failed to delete bank account");
            }
          },
        },
      ],
    );
  };

  const resetBankForm = () => {
    setBankForm({
      account_holder_name: "",
      bank_name: "",
      account_number: "",
      iban: "",
      swift_code: "",
      is_default: false,
    });
    setEditingBank(null);
  };

  const openEditBank = (bank: BankAccount) => {
    setEditingBank(bank);
    setBankForm({
      account_holder_name: bank.account_holder_name,
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      iban: bank.iban || "",
      swift_code: bank.swift_code || "",
      is_default: bank.is_default,
    });
    setShowBankModal(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPaymentData();
  };

  const loadMoreTransactions = () => {
    if (!transactionsLoading && transactionsHasMore) {
      fetchTransactions(transactionsPage + 1, false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "failed":
        return "#EF4444";
      case "refunded":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "checkmark-circle";
      case "pending":
        return "time";
      case "failed":
        return "close-circle";
      case "refunded":
        return "refresh";
      default:
        return "help-circle";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toFixed(2)}`;
  };

  const maskAccountNumber = (number: string) => {
    if (number.length <= 4) return number;
    return "•".repeat(number.length - 4) + number.slice(-4);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading payment settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Setup</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="help-circle-outline" size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsContainer}
        >
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: "#10B98110" },
              ]}
            >
              <Ionicons name="wallet-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.statValue}>
              {formatCurrency(stats.total_earnings)}
            </Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: "#F59E0B10" },
              ]}
            >
              <Ionicons name="time-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>
              {formatCurrency(stats.pending_payouts)}
            </Text>
            <Text style={styles.statLabel}>Pending Payouts</Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: "#3B82F610" },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#3B82F6"
              />
            </View>
            <Text style={styles.statValue}>{stats.completed_payouts}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: "#8B5CF610" },
              ]}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={20}
                color="#8B5CF6"
              />
            </View>
            <Text style={styles.statValue}>{stats.total_transactions}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
        </ScrollView>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "methods" && styles.tabActive]}
          onPress={() => setActiveTab("methods")}
        >
          <Ionicons
            name="card-outline"
            size={16}
            color={activeTab === "methods" ? "#FF6B35" : "#6B7280"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "methods" && styles.tabTextActive,
            ]}
          >
            Payment Methods
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "bank" && styles.tabActive]}
          onPress={() => setActiveTab("bank")}
        >
          <Ionicons
            name="business-outline"
            size={16}
            color={activeTab === "bank" ? "#FF6B35" : "#6B7280"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "bank" && styles.tabTextActive,
            ]}
          >
            Bank Accounts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "transactions" && styles.tabActive]}
          onPress={() => setActiveTab("transactions")}
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={16}
            color={activeTab === "transactions" ? "#FF6B35" : "#6B7280"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "transactions" && styles.tabTextActive,
            ]}
          >
            Transactions
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === "methods" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="card-outline" size={20} color="#FF6B35" />
                <Text style={styles.sectionTitle}>Payment Methods</Text>
              </View>
              <TouchableOpacity style={styles.helpButton}>
                <Ionicons
                  name="help-circle-outline"
                  size={18}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Configure how customers can pay for orders
            </Text>

            {paymentMethods.map((method) => (
              <View key={method.id} style={styles.methodCard}>
                <View style={styles.methodHeader}>
                  <View style={styles.methodIcon}>
                    <Ionicons
                      name={
                        method.type === "cash_on_delivery"
                          ? "cash-outline"
                          : method.type === "credit_card"
                            ? "card-outline"
                            : method.type === "digital_wallet"
                              ? "wallet-outline"
                              : "card-outline"
                      }
                      size={20}
                      color="#FF6B35"
                    />
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodName}>
                      {method.type === "cash_on_delivery"
                        ? "Cash on Delivery"
                        : method.type === "credit_card"
                          ? "Credit Card"
                          : method.type === "digital_wallet"
                            ? "Digital Wallet"
                            : method.type === "debit_card"
                              ? "Debit Card"
                              : method.type.replace(/_/g, " ")}
                    </Text>
                    {method.provider && (
                      <Text style={styles.methodType}>{method.provider}</Text>
                    )}
                  </View>
                  <Switch
                    value={method.is_active}
                    onValueChange={() => togglePaymentMethod(method)}
                    trackColor={{ false: "#E5E7EB", true: "#FF6B35" }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {method.card_last_four && (
                  <View style={styles.methodDetails}>
                    <View style={styles.cardInfoRow}>
                      <Ionicons name="card-outline" size={14} color="#6B7280" />
                      <Text style={styles.cardInfo}>
                        •••• {method.card_last_four}
                      </Text>
                    </View>
                  </View>
                )}

                {method.is_default && (
                  <View style={styles.defaultBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color="#10B981"
                    />
                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.learnMoreButton}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#FF6B35"
              />
              <Text style={styles.learnMoreText}>
                Learn about payment processing
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "bank" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="business-outline" size={20} color="#FF6B35" />
                <Text style={styles.sectionTitle}>Bank Accounts</Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  resetBankForm();
                  setShowBankModal(true);
                }}
              >
                <Ionicons name="add" size={18} color="#FF6B35" />
                <Text style={styles.addButtonText}>Add Bank</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              Add bank accounts for payouts
            </Text>

            {bankAccounts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons name="business-outline" size={48} color="#D1D5DB" />
                </View>
                <Text style={styles.emptyTitle}>No Bank Accounts</Text>
                <Text style={styles.emptyText}>
                  Add a bank account to receive payouts
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => {
                    resetBankForm();
                    setShowBankModal(true);
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color="#FF6B35"
                  />
                  <Text style={styles.emptyStateButtonText}>
                    Add Bank Account
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              bankAccounts.map((bank) => (
                <View key={bank.id} style={styles.bankCard}>
                  <View style={styles.bankHeader}>
                    <View style={styles.bankIcon}>
                      <Ionicons name="business" size={18} color="#10B981" />
                    </View>
                    <View style={styles.bankInfo}>
                      <Text style={styles.bankName}>{bank.bank_name}</Text>
                      <Text style={styles.accountHolder}>
                        {bank.account_holder_name}
                      </Text>
                    </View>
                    {bank.is_default && (
                      <View style={styles.defaultBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={12}
                          color="#10B981"
                        />
                        <Text style={styles.defaultText}>Default</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.bankDetails}>
                    <View style={styles.bankDetailRow}>
                      <Ionicons name="hash-outline" size={12} color="#6B7280" />
                      <Text style={styles.bankDetailLabel}>
                        Account Number:
                      </Text>
                      <Text style={styles.bankDetailValue}>
                        {maskAccountNumber(bank.account_number)}
                      </Text>
                    </View>
                    {bank.iban && (
                      <View style={styles.bankDetailRow}>
                        <Ionicons
                          name="document-text-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text style={styles.bankDetailLabel}>IBAN:</Text>
                        <Text style={styles.bankDetailValue}>{bank.iban}</Text>
                      </View>
                    )}
                    {bank.swift_code && (
                      <View style={styles.bankDetailRow}>
                        <Ionicons
                          name="code-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text style={styles.bankDetailLabel}>SWIFT:</Text>
                        <Text style={styles.bankDetailValue}>
                          {bank.swift_code}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.bankActions}>
                    <TouchableOpacity
                      style={styles.bankAction}
                      onPress={() => openEditBank(bank)}
                    >
                      <Ionicons
                        name="create-outline"
                        size={16}
                        color="#3B82F6"
                      />
                      <Text style={styles.bankActionText}>Edit</Text>
                    </TouchableOpacity>
                    <View style={styles.actionDivider} />
                    <TouchableOpacity
                      style={styles.bankAction}
                      onPress={() => handleDeleteBank(bank.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color="#EF4444"
                      />
                      <Text style={[styles.bankActionText, styles.deleteText]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "transactions" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={20}
                  color="#FF6B35"
                />
                <Text style={styles.sectionTitle}>Transaction History</Text>
              </View>
              <TouchableOpacity style={styles.filterButton}>
                <Ionicons name="filter-outline" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>
              View all payment transactions
            </Text>

            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={48}
                    color="#D1D5DB"
                  />
                </View>
                <Text style={styles.emptyTitle}>No Transactions</Text>
                <Text style={styles.emptyText}>
                  Transactions will appear here once orders are placed
                </Text>
              </View>
            ) : (
              <>
                {transactions.map((transaction) => (
                  <TouchableOpacity
                    key={transaction.id}
                    style={styles.transactionCard}
                    onPress={() => {
                      setSelectedTransaction(transaction);
                      setShowTransactionModal(true);
                    }}
                  >
                    <View style={styles.transactionHeader}>
                      <View style={styles.transactionLeft}>
                        <View
                          style={[
                            styles.transactionIcon,
                            {
                              backgroundColor:
                                getStatusColor(transaction.status) + "20",
                            },
                          ]}
                        >
                          <Ionicons
                            name={getStatusIcon(transaction.status)}
                            size={16}
                            color={getStatusColor(transaction.status)}
                          />
                        </View>
                        <View>
                          <Text style={styles.transactionId}>
                            {transaction.transaction_id}
                          </Text>
                          <Text style={styles.transactionOrder}>
                            Order #{transaction.orders.order_number}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.transactionStatus,
                          {
                            backgroundColor:
                              getStatusColor(transaction.status) + "20",
                          },
                        ]}
                      >
                        <Ionicons
                          name={getStatusIcon(transaction.status)}
                          size={10}
                          color={getStatusColor(transaction.status)}
                        />
                        <Text
                          style={[
                            styles.transactionStatusText,
                            { color: getStatusColor(transaction.status) },
                          ]}
                        >
                          {transaction.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.transactionDetails}>
                      <View style={styles.transactionRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text style={styles.transactionDate}>
                          {formatDate(transaction.created_at)}
                        </Text>
                      </View>
                      <View style={styles.transactionRow}>
                        <Ionicons
                          name="card-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text style={styles.transactionMethod}>
                          {transaction.payment_method}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.transactionFooter}>
                      <Text style={styles.transactionAmount}>
                        {formatCurrency(transaction.amount)}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="#D1D5DB"
                      />
                    </View>
                  </TouchableOpacity>
                ))}

                {transactionsHasMore && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMoreTransactions}
                    disabled={transactionsLoading}
                  >
                    {transactionsLoading ? (
                      <ActivityIndicator size="small" color="#FF6B35" />
                    ) : (
                      <>
                        <Ionicons
                          name="refresh-outline"
                          size={16}
                          color="#FF6B35"
                        />
                        <Text style={styles.loadMoreText}>Load More</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bank Account Modal */}
      <Modal
        visible={showBankModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          resetBankForm();
          setShowBankModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="business-outline" size={20} color="#FF6B35" />
                <Text style={styles.modalTitle}>
                  {editingBank ? "Edit Bank Account" : "Add Bank Account"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  resetBankForm();
                  setShowBankModal(false);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelContainer}>
                  <Ionicons name="person-outline" size={14} color="#FF6B35" />
                  <Text style={styles.inputLabel}>Account Holder Name *</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter account holder name"
                  placeholderTextColor="#9CA3AF"
                  value={bankForm.account_holder_name}
                  onChangeText={(text) =>
                    setBankForm({ ...bankForm, account_holder_name: text })
                  }
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelContainer}>
                  <Ionicons name="business-outline" size={14} color="#FF6B35" />
                  <Text style={styles.inputLabel}>Bank Name *</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter bank name"
                  placeholderTextColor="#9CA3AF"
                  value={bankForm.bank_name}
                  onChangeText={(text) =>
                    setBankForm({ ...bankForm, bank_name: text })
                  }
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelContainer}>
                  <Ionicons name="hash-outline" size={14} color="#FF6B35" />
                  <Text style={styles.inputLabel}>Account Number *</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter account number"
                  placeholderTextColor="#9CA3AF"
                  value={bankForm.account_number}
                  onChangeText={(text) =>
                    setBankForm({ ...bankForm, account_number: text })
                  }
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelContainer}>
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color="#FF6B35"
                  />
                  <Text style={styles.inputLabel}>IBAN (Optional)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter IBAN"
                  placeholderTextColor="#9CA3AF"
                  value={bankForm.iban}
                  onChangeText={(text) =>
                    setBankForm({ ...bankForm, iban: text })
                  }
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelContainer}>
                  <Ionicons name="code-outline" size={14} color="#FF6B35" />
                  <Text style={styles.inputLabel}>SWIFT Code (Optional)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter SWIFT code"
                  placeholderTextColor="#9CA3AF"
                  value={bankForm.swift_code}
                  onChangeText={(text) =>
                    setBankForm({ ...bankForm, swift_code: text })
                  }
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.checkboxRow}>
                <Switch
                  value={bankForm.is_default}
                  onValueChange={(value) =>
                    setBankForm({ ...bankForm, is_default: value })
                  }
                  trackColor={{ false: "#E5E7EB", true: "#FF6B35" }}
                  thumbColor="#FFFFFF"
                />
                <Ionicons name="star-outline" size={16} color="#F59E0B" />
                <Text style={styles.checkboxLabel}>Set as default account</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  submitting && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveBank}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={editingBank ? "save-outline" : "add-circle-outline"}
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.saveButtonText}>
                      {editingBank ? "Update Account" : "Add Account"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Transaction Detail Modal */}
      <Modal
        visible={showTransactionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSelectedTransaction(null);
          setShowTransactionModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#FF6B35"
                />
                <Text style={styles.modalTitle}>Transaction Details</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedTransaction(null);
                  setShowTransactionModal(false);
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <View style={styles.detailCardTitleRow}>
                      <Ionicons
                        name="receipt-outline"
                        size={16}
                        color="#6B7280"
                      />
                      <Text style={styles.detailCardTitle}>Transaction ID</Text>
                    </View>
                    <Text style={styles.detailCardValue}>
                      {selectedTransaction.transaction_id}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons name="cube-outline" size={14} color="#6B7280" />
                      <Text style={styles.detailLabel}>Order Number</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      #{selectedTransaction.orders.order_number}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons name="cash-outline" size={14} color="#6B7280" />
                      <Text style={styles.detailLabel}>Amount</Text>
                    </View>
                    <Text style={styles.detailValueAmount}>
                      {formatCurrency(selectedTransaction.amount)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons name="card-outline" size={14} color="#6B7280" />
                      <Text style={styles.detailLabel}>Payment Method</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.payment_method}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color="#6B7280"
                      />
                      <Text style={styles.detailLabel}>Status</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            getStatusColor(selectedTransaction.status) + "20",
                        },
                      ]}
                    >
                      <Ionicons
                        name={getStatusIcon(selectedTransaction.status)}
                        size={12}
                        color={getStatusColor(selectedTransaction.status)}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: getStatusColor(selectedTransaction.status) },
                        ]}
                      >
                        {selectedTransaction.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <View style={styles.detailLabelContainer}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color="#6B7280"
                      />
                      <Text style={styles.detailLabel}>Date & Time</Text>
                    </View>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedTransaction.created_at)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.viewOrderButton}
                  onPress={() => {
                    setShowTransactionModal(false);
                    setSelectedTransaction(null);
                    router.push(
                      `/(restaurant)/orders/${selectedTransaction.order_id}`,
                    );
                  }}
                >
                  <Ionicons name="receipt-outline" size={16} color="#FF6B35" />
                  <Text style={styles.viewOrderButtonText}>
                    View Order Details
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  headerIcon: {
    padding: 4,
  },
  statsScroll: {
    backgroundColor: "#FFFFFF",
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    minWidth: 120,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  tabActive: {
    backgroundColor: "#FF6B3510",
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#FF6B35",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 16,
    marginLeft: 28,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B3510",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B35",
  },
  helpButton: {
    padding: 4,
  },
  filterButton: {
    padding: 4,
  },
  methodCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  methodHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6B3510",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  methodType: {
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
  },
  methodDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  cardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardInfo: {
    fontSize: 12,
    color: "#374151",
  },
  learnMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  learnMoreText: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#FF6B3510",
    borderRadius: 20,
  },
  emptyStateButtonText: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "600",
  },
  bankCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  bankHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bankIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10B98110",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  accountHolder: {
    fontSize: 11,
    color: "#6B7280",
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B98120",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#10B981",
  },
  bankDetails: {
    marginBottom: 12,
  },
  bankDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  bankDetailLabel: {
    width: 100,
    fontSize: 11,
    color: "#6B7280",
    marginLeft: 2,
  },
  bankDetailValue: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    color: "#374151",
  },
  bankActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
  },
  bankAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
  },
  bankActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  deleteText: {
    color: "#EF4444",
  },
  transactionCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  transactionId: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  transactionOrder: {
    fontSize: 11,
    color: "#6B7280",
  },
  transactionStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  transactionDetails: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  transactionDate: {
    fontSize: 11,
    color: "#6B7280",
  },
  transactionMethod: {
    fontSize: 11,
    color: "#6B7280",
  },
  transactionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FF6B35",
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  loadMoreText: {
    fontSize: 13,
    color: "#FF6B35",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 0.8,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 14,
    color: "#111827",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  saveButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  detailCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  detailCardHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  detailCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  detailCardTitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  detailCardValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  detailValueAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF6B35",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  viewOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B3510",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  viewOrderButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
  },
});
