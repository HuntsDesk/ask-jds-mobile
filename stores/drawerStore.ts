import { create } from 'zustand';
import { Keyboard } from 'react-native';

interface DrawerStore {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const useDrawerStore = create<DrawerStore>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => {
    if (isOpen) {
      Keyboard.dismiss(); // Dismiss keyboard when opening drawer
    }
    set({ isOpen });
  },
})); 