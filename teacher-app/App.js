import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import ClassListScreen from './src/screens/ClassListScreen';
import ScannerScreen   from './src/screens/ScannerScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1e1b4b',
            borderTopColor: '#312e81',
          },
          tabBarActiveTintColor:   '#6366f1',
          tabBarInactiveTintColor: '#4c4f6b',
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        }}
      >
        <Tab.Screen
          name="ClassList"
          component={ClassListScreen}
          options={{
            tabBarLabel: 'Class List',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📋</Text>,
          }}
        />
        <Tab.Screen
          name="Scanner"
          component={ScannerScreen}
          options={{
            tabBarLabel: 'QR Scanner',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📷</Text>,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
