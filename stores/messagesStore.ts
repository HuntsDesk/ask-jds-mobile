import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  thread_id: string;
  pending?: boolean;
  failed?: boolean;
}

interface MessagesStore {
  messages: Message[];
  pendingMessages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  syncMessages: (threadId: string) => Promise<void>;
  retryFailedMessages: () => Promise<void>;
}

export const useMessagesStore = create<MessagesStore>((set, get) => ({
  messages: [],
  pendingMessages: [],
  
  setMessages: (messages) => {
    set({ messages });
    // Add error handling
    AsyncStorage.setItem('cached_messages', JSON.stringify(messages))
      .catch(err => console.error('Error caching messages:', err));
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
      pendingMessages: message.pending 
        ? [...state.pendingMessages, message]
        : state.pendingMessages
    }));
  },

  syncMessages: async (threadId: string) => {
    try {
      // Get cached messages for this thread
      const cached = await AsyncStorage.getItem(`cached_messages_${threadId}`);
      if (cached) {
        set({ messages: JSON.parse(cached) });
      }

      // Sync with server
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        set({ messages: data });
        AsyncStorage.setItem(`cached_messages_${threadId}`, JSON.stringify(data))
          .catch(err => console.error('Error caching messages:', err));
      }
    } catch (err) {
      console.error('Error syncing messages:', err);
    }
  },

  retryFailedMessages: async () => {
    const { pendingMessages } = get();
    for (const message of pendingMessages) {
      try {
        const { error } = await supabase
          .from('messages')
          .insert([{
            content: message.content,
            role: message.role,
            thread_id: message.thread_id,
          }]);

        if (error) throw error;

        // Remove from pending if successful
        set((state) => ({
          pendingMessages: state.pendingMessages.filter(m => m.id !== message.id)
        }));
      } catch (err) {
        console.error('Error retrying message:', err);
      }
    }
  },
})); 