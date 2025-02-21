import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '../../stores/colorScheme';

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <View style={[
      styles.container,
      { backgroundColor: colorScheme === 'dark' ? '#343541' : '#FFFFFF' }
    ]}>
      <View style={styles.section}>
        <Text style={[
          styles.sectionTitle,
          { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
        ]}>
          Appearance
        </Text>
        
        <View style={styles.option}>
          <TouchableOpacity
            style={[
              styles.themeButton,
              colorScheme === 'light' && styles.activeTheme
            ]}
            onPress={() => setColorScheme('light')}
          >
            <Ionicons name="sunny" size={24} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
            <Text style={[
              styles.themeText,
              { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
            ]}>Light</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeButton,
              colorScheme === 'dark' && styles.activeTheme
            ]}
            onPress={() => setColorScheme('dark')}
          >
            <Ionicons name="moon" size={24} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
            <Text style={[
              styles.themeText,
              { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
            ]}>Dark</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeButton,
              colorScheme === 'system' && styles.activeTheme
            ]}
            onPress={() => setColorScheme('system')}
          >
            <Ionicons name="phone-portrait" size={24} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
            <Text style={[
              styles.themeText,
              { color: colorScheme === 'dark' ? '#FFFFFF' : '#000000' }
            ]}>System</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  themeButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444654',
    width: '30%',
  },
  activeTheme: {
    backgroundColor: '#444654',
  },
  themeText: {
    marginTop: 8,
    fontSize: 14,
  },
});