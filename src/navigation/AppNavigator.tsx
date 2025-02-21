import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SideDrawer } from '../components/SideDrawer';
import ChatScreen from '../app/(tabs)/index';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator
        screenOptions={{
          headerLeft: () => (
            <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
              <Ionicons name="menu" size={24} color="white" />
            </TouchableOpacity>
          ),
          headerStyle: {
            backgroundColor: '#343541',
          },
          headerTintColor: '#fff',
        }}
      >
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen}
          options={{
            title: 'Ask JDS',
          }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{
            title: 'Settings',
          }}
        />
      </Stack.Navigator>

      {isDrawerOpen && (
        <View 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            flexDirection: 'row',
          }}
        >
          <SideDrawer onClose={() => setIsDrawerOpen(false)} />
          <TouchableOpacity 
            style={{ flex: 1 }}
            onPress={() => setIsDrawerOpen(false)}
          />
        </View>
      )}
    </View>
  );
}; 