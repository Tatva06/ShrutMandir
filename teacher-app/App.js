import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen          from './src/screens/LoginScreen';
import ClassesHomeScreen    from './src/screens/ClassesHomeScreen';
import ClassListScreen      from './src/screens/ClassListScreen';
import StudentProfileScreen from './src/screens/StudentProfileScreen';
import ScannerScreen        from './src/screens/ScannerScreen';
import DashboardScreen      from './src/screens/DashboardScreen';
import TeacherProfileScreen from './src/screens/TeacherProfileScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export default function App() {
  const [loading, setLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userData, setUserData] = useState(null);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const data = await AsyncStorage.getItem('userData');
      if (token && data) {
        setUserToken(token);
        setUserData(JSON.parse(data));
      } else {
        setUserToken(null);
        setUserData(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setUserToken(null);
      setUserData(null);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0e17', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#818cf8" size="large" />
      </View>
    );
  }

  // ─── Classes Stack ────────────────────────────────────────────────────────────
  function ClassesStack() {
    return (
      <Stack.Navigator
        screenOptions={{
          headerStyle:      { backgroundColor: '#1e1b4b' },
          headerTintColor:  '#e0e7ff',
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        }}
      >
        <Stack.Screen
          name="ClassesHome"
          component={ClassesHomeScreen}
          options={{ title: '🎵 ShrutMandir' }}
        />
        <Stack.Screen
          name="ClassList"
          component={ClassListScreen}
          options={({ route }) => ({ title: route.params?.className ?? 'Students' })}
        />
        <Stack.Screen
          name="StudentProfile"
          component={StudentProfileScreen}
          options={({ route }) => ({
            title: route.params?.student?.name ?? 'Student Profile',
          })}
        />
      </Stack.Navigator>
    );
  }

  return (
    <NavigationContainer>
      {userToken === null ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login">
            {props => <LoginScreen {...props} onLoginSuccess={checkLoginStatus} />}
          </Stack.Screen>
        </Stack.Navigator>
      ) : (
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#1e1b4b',
              borderTopColor:  '#312e81',
              paddingBottom:   4,
              height:          60,
            },
            tabBarActiveTintColor:   '#818cf8',
            tabBarInactiveTintColor: '#4c4f6b',
            tabBarLabelStyle:        { fontSize: 11, fontWeight: '600', marginBottom: 4 },
          }}
        >
          <Tab.Screen
            name="Classes"
            component={ClassesStack}
            options={{
              tabBarLabel: 'Classes',
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📚</Text>,
            }}
          />
          <Tab.Screen
            name="Scanner"
            component={ScannerScreen}
            options={{
              tabBarLabel: 'QR Scanner',
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📷</Text>,
            }}
          />
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              tabBarLabel: 'Dashboard',
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
            }}
          />
          <Tab.Screen
            name="Profile"
            options={{
              tabBarLabel: 'Profile',
              tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
            }}
          >
            {props => <TeacherProfileScreen {...props} userData={userData} onLogout={handleLogout} />}
          </Tab.Screen>
        </Tab.Navigator>
      )}
    </NavigationContainer>
  );
}
