import { Stack } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, LogBox, Platform } from 'react-native';
import { useDrawerStore } from '../stores/drawerStore';
import { SideDrawer } from '../components/SideDrawer';
import { useColorScheme } from '../stores/colorScheme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../components/ErrorFallback';
import { useEffect } from 'react';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

// Suppress specific warnings
if (Platform.OS === 'web') {
  LogBox.ignoreLogs([
    'Warning: findDOMNode is deprecated',
    'Animated: `useNativeDriver` is not supported'
  ]);
}

export default function RootLayout() {
  const { isOpen, setIsOpen } = useDrawerStore();
  const { effectiveColorScheme, initializeColorScheme } = useColorScheme();

  useEffect(() => {
    initializeColorScheme();
  }, []);

  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>

        {isOpen && (
          <View style={styles.overlay}>
            <SideDrawer onClose={() => setIsOpen(false)} />
            <TouchableOpacity 
              style={styles.backdrop}
              onPress={() => setIsOpen(false)}
            />
          </View>
        )}
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
  },
});
