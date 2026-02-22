import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { initDb } from './db';
import HomeScreen from './screens/HomeScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import VitalsScreen from './screens/VitalsScreen';
import MealScreen from './screens/MealScreen';
import WorkoutScreen from './screens/WorkoutScreen';
import SummaryScreen from './screens/SummaryScreen';
import AdviceScreen from './screens/AdviceScreen';
import PlanScreen from './screens/PlanScreen';
import SettingsScreen from './screens/SettingsScreen';
import { AppProvider } from './state/AppContext';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => { initDb(); }, []);

  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName='Onboarding'>
          <Stack.Screen name='Onboarding' component={OnboardingScreen} />
          <Stack.Screen name='Home' component={HomeScreen} />
          <Stack.Screen name='Vitals' component={VitalsScreen} />
          <Stack.Screen name='Meal' component={MealScreen} />
          <Stack.Screen name='Workout' component={WorkoutScreen} />
          <Stack.Screen name='Summary' component={SummaryScreen} />
          <Stack.Screen name='Advice' component={AdviceScreen} />
          <Stack.Screen name='Plan' component={PlanScreen} />
          <Stack.Screen name='Settings' component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
