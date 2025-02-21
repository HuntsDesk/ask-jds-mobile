import { create } from 'zustand';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ColorScheme = 'light' | 'dark' | 'system';

interface ColorSchemeStore {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  effectiveColorScheme: 'light' | 'dark';
  initializeColorScheme: () => Promise<void>;
}

const STORAGE_KEY = '@color_scheme';

export const useColorScheme = create<ColorSchemeStore>((set, get) => ({
  colorScheme: 'system',
  effectiveColorScheme: Appearance.getColorScheme() || 'light',
  
  initializeColorScheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const scheme = stored as ColorScheme;
        set({ 
          colorScheme: scheme,
          effectiveColorScheme: scheme === 'system' 
            ? Appearance.getColorScheme() || 'light'
            : scheme
        });
      }
    } catch (err) {
      console.error('Error loading color scheme:', err);
    }
  },

  setColorScheme: async (scheme) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, scheme);
      set({ 
        colorScheme: scheme,
        effectiveColorScheme: scheme === 'system' 
          ? Appearance.getColorScheme() || 'light'
          : scheme
      });
    } catch (err) {
      console.error('Error saving color scheme:', err);
    }
  },
}));

// Add appearance change listener
Appearance.addChangeListener(({ colorScheme }) => {
  const store = useColorScheme.getState();
  if (store.colorScheme === 'system') {
    store.setColorScheme('system'); // This will update effectiveColorScheme
  }
});

export const fonts = {
  regular: 'Avenir-Medium',
  bold: 'Avenir-Heavy',
  light: 'Avenir-Light',
};

// Update colors with font families
export const colors = {
  light: {
    background: '#FFFFFF',
    text: '#000000',
    inputBackground: '#F7F7F8',
    border: '#E5E5E5',
    userMessage: '#10A37F',
    assistantMessage: '#F7F7F8',
    assistantText: '#000000',
    fontFamily: fonts.regular,
    fontFamilyBold: fonts.bold,
  },
  dark: {
    background: '#343541',
    text: '#FFFFFF',
    inputBackground: '#40414F',
    border: '#444654',
    userMessage: '#10A37F',
    assistantMessage: '#444654',
    assistantText: '#FFFFFF',
    fontFamily: fonts.regular,
    fontFamilyBold: fonts.bold,
  },
}; 