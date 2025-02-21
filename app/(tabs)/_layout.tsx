import { Tabs } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDrawerStore } from '../../stores/drawerStore';

export default function TabLayout() {
  const { setIsOpen } = useDrawerStore();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#343541',
        },
        headerTintColor: '#fff',
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => setIsOpen(true)}
            style={{ marginLeft: 16 }}
          >
            <Ionicons name="menu" size={24} color="white" />
          </TouchableOpacity>
        ),
        tabBarStyle: {
          display: 'none'
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ask JDS',
          headerShadowVisible: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShadowVisible: false,
        }}
      />
    </Tabs>
  );
}