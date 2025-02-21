import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export const SideDrawer = ({ onClose }: { onClose: () => void }) => {
  const navigation = useNavigation();

  const navigateToSettings = () => {
    navigation.navigate('Settings');
    onClose();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Menu</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={navigateToSettings}
        >
          <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          <Text style={styles.menuItemText}>Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#343541',
    width: '80%',
    maxWidth: 300,
    borderRightWidth: 1,
    borderRightColor: '#444654',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444654',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444654',
  },
  menuItemText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
}); 