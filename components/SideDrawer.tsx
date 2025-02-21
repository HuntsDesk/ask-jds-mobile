import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';

interface Thread {
  id: string;
  title: string;
  created_at: string;
}

export const SideDrawer = ({ onClose }: { onClose: () => void }) => {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [session, setSession] = useState<any>(null);
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingThread, setIsDeletingThread] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    setIsLoading(true);
    try {
      const { data: threadsData, error } = await supabase
        .from('threads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setThreads(threadsData || []);
    } catch (err) {
      console.error('Error loading threads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteThread = async (threadId: string) => {
    setIsDeletingThread(threadId);
    try {
      // Delete messages first
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('thread_id', threadId);
      
      if (messagesError) throw messagesError;

      // Then delete the thread
      const { error: threadError } = await supabase
        .from('threads')
        .delete()
        .eq('id', threadId);

      if (threadError) throw threadError;

      // Verify deletion
      const { data: verifyThread } = await supabase
        .from('threads')
        .select('id')
        .eq('id', threadId)
        .single();

      if (verifyThread) {
        throw new Error('Thread deletion failed');
      }

      // Update local state only after successful deletion
      setThreads(prev => prev.filter(t => t.id !== threadId));
    } catch (err) {
      console.error('Error deleting thread:', err);
      // Show error to user
      Alert.alert('Error', 'Failed to delete thread. Please try again.');
    } finally {
      setIsDeletingThread(null);
    }
  };

  const navigateToThread = (threadId: string) => {
    router.push(`/?threadId=${threadId}`);
    onClose();
  };

  const startNewThread = async () => {
    try {
      const { data: thread, error } = await supabase
        .from('threads')
        .insert([{
          user_id: session?.user?.id,
          title: 'New Thread'
        }])
        .select()
        .single();

      if (error) throw error;
      
      router.push(`/?threadId=${thread.id}`);
      onClose();
    } catch (err) {
      console.error('Error creating new thread:', err);
      Alert.alert('Error', 'Failed to create new thread');
    }
  };

  const groupThreadsByDate = (threads: Thread[]) => {
    const grouped: { [key: string]: Thread[] } = {};
    
    threads.forEach(thread => {
      const date = new Date(thread.created_at);
      let key = '';
      
      if (isToday(date)) {
        key = 'Today';
      } else if (isYesterday(date)) {
        key = 'Yesterday';
      } else if (isThisWeek(date)) {
        key = 'This Week';
      } else if (isThisMonth(date)) {
        key = 'This Month';
      } else {
        key = format(date, 'MMMM yyyy');
      }
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(thread);
    });
    
    return grouped;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Ask JDS</Text>
        <TouchableOpacity 
          style={styles.newButton}
          onPress={startNewThread}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.newButtonText}>New Thread</Text>
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <ActivityIndicator size="large" color="#10A37F" />
      ) : (
        <ScrollView>
          {Object.entries(groupThreadsByDate(threads)).map(([date, dateThreads]) => (
            <View key={date} style={styles.threadGroup}>
              <Text style={styles.threadGroupTitle}>{date}</Text>
              {dateThreads.map((thread) => (
                <Swipeable
                  key={thread.id}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      disabled={isDeletingThread === thread.id}
                      onPress={() => deleteThread(thread.id)}
                    >
                      {isDeletingThread === thread.id ? (
                        <ActivityIndicator color="#FF453A" />
                      ) : (
                        <Ionicons name="trash-outline" size={24} color="#FF453A" />
                      )}
                    </TouchableOpacity>
                  )}
                >
                  <TouchableOpacity 
                    style={styles.threadItem}
                    onPress={() => navigateToThread(thread.id)}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.threadTitle} numberOfLines={1}>
                      {thread.title || 'New Thread'}
                    </Text>
                  </TouchableOpacity>
                </Swipeable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => {
            router.push('/settings');
            onClose();
          }}
        >
          <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          <Text style={styles.menuItemText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#202123',
    width: '80%',
    maxWidth: 300,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444654',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#444654',
    borderRadius: 6,
    margin: 8,
  },
  newButtonText: {
    color: '#FFFFFF',
    marginLeft: 12,
    fontSize: 14,
  },
  threadList: {
    padding: 8,
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 6,
    marginVertical: 1,
  },
  threadTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#444654',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 12,
  },
  deleteButton: {
    backgroundColor: '#FF453A20',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  threadGroup: {
    marginBottom: 16,
  },
  threadGroupTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    paddingHorizontal: 8,
    textTransform: 'uppercase',
  },
}); 