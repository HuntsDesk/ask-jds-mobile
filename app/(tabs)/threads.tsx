import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

interface Thread {
  id: string;
  title: string;
  created_at: string;
}

export default function ThreadsScreen() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        router.replace('/auth');
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        router.replace('/auth');
      }
    });
  }, []);

  useEffect(() => {
    if (session) {
      loadThreads();
    }
  }, [session]);

  const loadThreads = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('threads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setThreads(data || []);
    } catch (err) {
      setError('Failed to load threads. Please try again.');
      console.error('Error loading threads:', err);
    } finally {
      setLoading(false);
    }
  };

  const createNewThread = async () => {
    if (!session) return;

    try {
      setError(null);
      const { data: newThread, error: createError } = await supabase
        .from('threads')
        .insert([
          {
            title: 'New Chat',
            user_id: session.user.id,
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      router.push(`/chat/${newThread.id}`);
    } catch (err) {
      setError('Failed to create new thread. Please try again.');
      console.error('Error creating thread:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!session) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10A37F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Conversations</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={createNewThread}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10A37F" />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.threadItem}
              onPress={() => router.push(`/chat/${item.id}`)}>
              <View style={styles.threadInfo}>
                <Ionicons
                  name="chatbubble-outline"
                  size={24}
                  color="#10A37F"
                  style={styles.threadIcon}
                />
                <View style={styles.threadDetails}>
                  <Text style={styles.threadTitle}>{item.title}</Text>
                  <Text style={styles.threadDate}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={24}
                color="#666"
              />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.threadsList}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#343541',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#343541',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444654',
    backgroundColor: '#343541',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10A37F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ff000020',
    borderBottomWidth: 1,
    borderBottomColor: '#ff000050',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 14,
  },
  threadsList: {
    padding: 16,
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#40414F',
    borderRadius: 8,
    marginBottom: 12,
  },
  threadInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  threadIcon: {
    marginRight: 12,
  },
  threadDetails: {
    flex: 1,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  threadDate: {
    fontSize: 14,
    color: '#666',
  },
});