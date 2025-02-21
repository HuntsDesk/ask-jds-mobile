import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkStore {
  isOnline: boolean;
  setIsOnline: (status: boolean) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: true,
  setIsOnline: (status) => set({ isOnline: status }),
}));

// Add cleanup
let unsubscribe: (() => void) | null = null;

// Update listener setup
unsubscribe = NetInfo.addEventListener(state => {
  useNetworkStore.getState().setIsOnline(state.isConnected ?? true);
});

// Add cleanup function
export const cleanup = () => {
  unsubscribe?.();
}; 