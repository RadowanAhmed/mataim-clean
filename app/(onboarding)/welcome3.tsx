// app/(onboarding)/welcome3.tsx
import { animations } from '@/constent/animations';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React from 'react';
import {
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useOnboarding } from '../../backend/OnboardingContext';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen3() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();

  // Load your Google Fonts (same as SignInScreen)
  const [fontsLoaded] = useFonts({
    'Caprasimo-Bold': require('../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Caprasimo/Caprasimo-Regular.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Medium.ttf'),
  });

  const handleGetStarted = async () => {
    console.log('Get Started clicked, completing onboarding...');
    await completeOnboarding();
    console.log('Onboarding completed, navigating to auth options...');
    router.replace('/(auth)');
  };

  // Wait for fonts to load before rendering
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Animation */}
      <View style={styles.animationContainer}>
        <LottieView
          source={animations.ready_to_order}
          autoPlay
          loop
          style={styles.animation}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Ready to Order?</Text>
        <Text style={styles.subtitle}>
          Join thousands of happy customers enjoying delicious meals from the best restaurants in UAE
        </Text>

        {/* Features */}
        <View style={styles.features}>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.featureText}>100+ Restaurants</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.featureText}>Fast Delivery</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.featureText}>Secure Payments</Text>
          </View>
        </View>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
        </View>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={handleGetStarted}
        >
          <Text style={styles.getStartedButtonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'System',
  },
  animationContainer: {
    height: height * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  animation: {
    width: width * 0.8,
    height: '100%',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    // Use your Google Font for the title
    fontFamily: 'Caprasimo-Bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    // Use your Google Font for the subtitle
    fontFamily: 'Poppins-SemiBold',
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  features: {
    gap: 12,
    marginBottom: 42,
    marginLeft: 12
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    // Use your Google Font for feature text
    fontFamily: 'Poppins-SemiBold',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e1e1e1',
  },
  activeDot: {
    backgroundColor: '#FF6B35',
    width: 24,
  },
  getStartedButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
    paddingVertical: 16
  },
  getStartedButtonText: {
    color: '#fff',
    fontSize: 16,
    // Use your Google Font for button text
    fontFamily: 'Poppins-SemiBold',
  },
});