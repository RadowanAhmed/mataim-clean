// backend/OnboardingContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface OnboardingContextType {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>; // Optional: Add reset functionality
  isLoading: boolean;
}

const OnboardingContext = createContext<OnboardingContextType>({} as OnboardingContextType);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      console.log('Checking onboarding status...');
      const value = await AsyncStorage.getItem('hasCompletedOnboarding');
      const completed = value === 'true';
      console.log('Onboarding status:', completed ? 'completed' : 'not completed');
      setHasCompletedOnboarding(completed);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasCompletedOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      console.log('Completing onboarding...');
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setHasCompletedOnboarding(true);
      console.log('Onboarding marked as completed');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error; // Optional: re-throw error if you want to handle it in components
    }
  };

  // Optional: Add reset functionality for testing or logout
  const resetOnboarding = async () => {
    try {
      console.log('Resetting onboarding...');
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      setHasCompletedOnboarding(false);
      console.log('Onboarding reset');
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      throw error;
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        completeOnboarding,
        resetOnboarding, // Include if you add the function
        isLoading,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};