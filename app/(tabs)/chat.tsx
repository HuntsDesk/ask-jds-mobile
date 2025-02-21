import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  thread_id: string;
}

interface Thread {
  id: string;
  title: string;
  created_at: string;
}

export default function ChatScreen() {
  const { id: threadId } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentThread, setCurrentThread] = useState<Thread | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState(null);
  const flatListRef = useRef<FlatList>(null);

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
    if (session && threadId) {
      loadThread();
    }
  }, [session, threadId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadThread = async () => {
    if (!session || !threadId) return;

    try {
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .select('*')
        .eq('id', threadId)
        .single();

      if (threadError) throw threadError;
      setCurrentThread(thread);
      await loadMessages(threadId);
    } catch (err) {
      setError('Failed to load thread. Please try again.');
      console.error('Error loading thread:', err);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      setError('Failed to load messages. Please try again.');
      console.error('Error loading messages:', err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !session || !currentThread) return;

    setIsLoading(true);
    setError(null);
    const userMessage = input.trim();
    setInput('');

    try {
      const { data: userData, error: userError } = await supabase
        .from('messages')
        .insert([
          {
            content: userMessage,
            role: 'user',
            user_id: session.user.id,
            thread_id: currentThread.id,
          },
        ])
        .select()
        .single();

      if (userError) throw userError;

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('No active session');

      const response = await fetch('https://prbbuxgirnecbkpdpgcb.functions.supabase.co/chat-relay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          provider: 'openai',
          model: 'gpt-4',
          prompt: userMessage,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get AI response');
      }

      const aiResponse = await response.json();
      const assistantMessage = aiResponse.choices[0].message.content;

      const { error: assistantError } = await supabase
        .from('messages')
        .insert([
          {
            content: assistantMessage,
            role: 'assistant',
            user_id: session.user.id,
            thread_id: currentThread.id,
          },
        ]);

      if (assistantError) throw assistantError;

      await loadMessages(currentThread.id);
    } catch (err) {
      setError(err.message || 'Failed to send message. Please try again.');
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}>
      <Text style={styles.messageText}>{item.content}</Text>
    </View>
  ), []);

  if (!session || !currentThread) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10A37F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ask JDS</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messagesList, { pointerEvents: 'auto' }]}
        inverted={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask a legal question..."
          placeholderTextColor="#666"
          multiline
          editable={!isLoading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#10A37F" />
          ) : (
            <Ionicons
              name="send"
              size={24}
              color={!input.trim() || isLoading ? '#666' : '#10A37F'}
            />
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444654',
    backgroundColor: '#343541',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
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
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#10A37F',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#444654',
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#444654',
    backgroundColor: '#343541',
  },
  input: {
    flex: 1,
    backgroundColor: '#40414F',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#40414F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});