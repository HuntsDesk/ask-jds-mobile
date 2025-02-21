import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
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
  Animated,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '../../stores/colorScheme';
import { colors } from '../../stores/colorScheme';
import { useMessagesStore } from '../../stores/messagesStore';
import { useNetworkStore } from '../../stores/networkStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackoffDelay, sleep } from '../../utils/backoff';
import * as Clipboard from 'expo-clipboard';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  thread_id: string;
  pending?: boolean;
  failed?: boolean;
  offline?: boolean;
  retryCount?: number;
}

interface Thread {
  id: string;
  title: string;
  created_at: string;
}

interface Session {
  user: {
    id: string;
  };
  access_token: string;
}

interface StructuredResponse {
  analysis: {
    legalIssues: string[];
    relevantCases: Array<{
      name: string;
      citation: string;
      relevance: string;
    }>;
    recommendation: string;
    confidence: number;
  }
}

interface SystemPrompt {
  id: string;
  content: string;
  is_active: boolean;
  created_at: string;
}

export default function ChatScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentThread, setCurrentThread] = useState<Thread | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { effectiveColorScheme } = useColorScheme();
  const theme = colors[effectiveColorScheme];
  const router = useRouter();
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const { messages: storeMessages, addMessage, syncMessages } = useMessagesStore();
  const { isOnline } = useNetworkStore();

  // Use a single animated value for background
  const backgroundAnim = useRef(new Animated.Value(0)).current;
  
  // Use a Map instead of a plain object for animations
  const fadeAnims = useRef(new Map<string, Animated.Value>());

  // Initialize animation when messages change
  useEffect(() => {
    messages.forEach((message, index) => {
      if (!fadeAnims.current.has(message.id)) {
        const anim = new Animated.Value(0);
        fadeAnims.current.set(message.id, anim);
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          delay: index * 100,
          useNativeDriver: true,
        }).start();
      }
    });

    // Cleanup old animations
    const currentIds = new Set(messages.map(m => m.id));
    Array.from(fadeAnims.current.keys()).forEach(id => {
      if (!currentIds.has(id)) {
        fadeAnims.current.delete(id);
      }
    });
  }, [messages]);

  useEffect(() => {
    Animated.timing(backgroundAnim, {
      toValue: effectiveColorScheme === 'dark' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [effectiveColorScheme]);

  const animatedBackground = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.light.background, colors.dark.background],
  });

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session as Session | null);
        if (!session) {
          router.replace('/auth');
        }
      } catch (err: unknown) {
        console.error('Error initializing session:', err);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeSession();
  }, [router]);

  useEffect(() => {
    if (session) {
      if (threadId) {
        loadThread(threadId);
      } else {
        // Check for existing threads first
        checkExistingThreads();
      }
    }
  }, [session, threadId]);

  // Auto-scroll when messages update
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // Add this effect to fetch the system prompt
  useEffect(() => {
    const fetchSystemPrompt = async () => {
      try {
        const { data, error } = await supabase
          .from('system_prompts')
          .select('*')
          .eq('is_active', true)
          .single();

        if (error) throw error;
        if (data) {
          console.log('Active system prompt:', data);
          setSystemPrompt(data.content);
        } else {
          console.warn('No active system prompt found');
        }
      } catch (err) {
        console.error('Error fetching system prompt:', err);
        setError('Failed to load system configuration');
      }
    };

    fetchSystemPrompt();
  }, []);

  useEffect(() => {
    if (session && currentThread && messages.length === 0 && !messages.some(m => m.id === 'welcome')) {
      setMessages([{
        id: 'welcome',
        content: "Hello! I'm your legal study buddy. I can help you understand legal concepts, prepare for exams, and discuss case law. What legal topic would you like to explore?",
        role: 'assistant',
        created_at: new Date().toISOString(),
        thread_id: currentThread.id
      }]);
    }
  }, [session, currentThread, messages]);

  // Add sync effect
  useEffect(() => {
    if (currentThread) {
      syncMessages(currentThread.id);
    }
  }, [currentThread]);

  const loadThread = async (id: string) => {
    try {
      // Load thread details
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .select('*')
        .eq('id', id)
        .single();

      if (threadError) throw threadError;
      setCurrentThread(thread);

      // Load messages for this thread
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);
    } catch (err) {
      setError('Failed to load thread');
      console.error('Error loading thread:', err);
    }
  };

  const initializeThread = async () => {
    if (!session) return;

    try {
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
      setCurrentThread(newThread);
      setMessages([]);
    } catch (err) {
      setError('Failed to create new thread');
      console.error('Error creating thread:', err);
    }
  };

  const checkExistingThreads = async () => {
    try {
      const { data: threads, error } = await supabase
        .from('threads')
        .select('*')
        .eq('user_id', session?.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (threads && threads.length > 0) {
        // Use most recent thread
        setCurrentThread(threads[0]);
        loadThread(threads[0].id);
      } else {
        // Only create new thread if none exist
        initializeThread();
      }
    } catch (err) {
      console.error('Error checking existing threads:', err);
      setError('Failed to load threads');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentThread) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Create new message
    const newMessage: Message = {
      id: Date.now().toString(),
      content: userMessage,
      role: 'user',
      created_at: new Date().toISOString(),
      thread_id: currentThread.id,
    };

    // Update messages immediately with new message
    setMessages(currentMessages => [...currentMessages, newMessage]);

    try {
      // Save user message first
      const { data: userData, error: userError } = await supabase
        .from('messages')
        .insert([{
          content: userMessage,
          role: 'user',
          user_id: session?.user.id,
          thread_id: currentThread.id,
        }])
        .select()
        .single();

      if (userError) throw new Error(`Failed to save user message: ${userError.message}`);

      // Get fresh session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('No active session');

      // Log request details
      console.log('Sending request to AI:', {
        systemPrompt,
        messageCount: messages.length,
        userMessage
      });

      // Call the edge function
      const response = await fetch('https://prbbuxgirnecbkpdpgcb.functions.supabase.co/chat-relay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          provider: 'openai',
          model: 'chatgpt-4o-latest',
          prompt: userMessage,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ]
        }),
      });

      // Log response status
      console.log('AI response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('AI error response:', errorData);
        throw new Error(errorData.message || `AI request failed with status ${response.status}`);
      }

      const aiResponse = await response.json();
      console.log('AI response received:', {
        status: response.status,
        hasChoices: !!aiResponse.choices,
        firstChoice: aiResponse.choices?.[0]
      });

      if (!aiResponse.choices?.[0]?.message?.content) {
        throw new Error('Invalid AI response format');
      }

      const assistantMessage = aiResponse.choices[0].message.content;

      // Save the assistant's response
      const { data: assistantData, error: assistantError } = await supabase
        .from('messages')
        .insert([{
          content: assistantMessage,
          role: 'assistant',
          user_id: session?.user?.id,
          thread_id: currentThread.id,
        }])
        .select()
        .single();

      if (assistantError) throw assistantError;

      // Update messages with AI response
      setMessages(currentMessages => [...currentMessages, {
        id: Date.now().toString(), // Use a new ID for AI message
        content: assistantMessage,
        role: 'assistant',
        created_at: new Date().toISOString(),
        thread_id: currentThread.id
      }]);

    } catch (err) {
      console.error('Full error details:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      // Update message status to failed
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id ? { ...msg, failed: true, pending: false } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const sendStructuredMessage = async () => {
    if (!input.trim() || isLoading || !session || !currentThread) return;

    setIsLoading(true);
    setError(null);
    const userMessage = input.trim();
    setInput('');

    // Immediately add user message to UI
    const messageId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: messageId,
      content: userMessage,
      role: 'user',
      created_at: new Date().toISOString(),
      thread_id: currentThread.id,
    }]);

    try {
      // Save user message
      const { data: userData, error: userError } = await supabase
        .from('messages')
        .insert([{
          content: userMessage,
          role: 'user',
          user_id: session.user.id,
          thread_id: currentThread.id,
        }])
        .select()
        .single();

      if (userError) throw userError;

      // Get the current session for authorization
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('No active session');

      // Call the edge function
      const response = await fetch('https://prbbuxgirnecbkpdpgcb.functions.supabase.co/chat-relay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          provider: 'openai',
          model: 'gpt-4o',
          messages: [
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            {
              role: 'system',
              content: `Return responses in the following JSON structure:
              {
                "analysis": {
                  "legalIssues": ["issue1", "issue2"],
                  "relevantCases": [
                    {
                      "name": "Case Name",
                      "citation": "Citation",
                      "relevance": "Why relevant"
                    }
                  ],
                  "recommendation": "Legal recommendation",
                  "confidence": 0.95
                }
              }`
            },
            {
              role: 'user',
              content: input
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get AI response');
      }

      const aiResponse = await response.json();
      const assistantMessage = aiResponse.choices[0].message.content;

      // Save the assistant's response
      const { error: assistantError } = await supabase
        .from('messages')
        .insert([{
          content: assistantMessage,
          role: 'assistant',
          user_id: session.user.id,
          thread_id: currentThread.id,
        }]);

      if (assistantError) throw assistantError;
      
      // Add AI response to messages
      const updatedMessages = messages.map(msg => 
        msg.id === messageId ? { ...msg, id: userData.id } : msg
      );
      setMessages(updatedMessages);

    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to send message');
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatAIMessage = (content: string) => {
    return content
      // Remove markdown headers
      .replace(/###\s*/g, '')
      // Remove markdown bold
      .replace(/\*\*(.*?)\*\*/g, '$1')
      // Remove emoji
      .replace(/[^\x00-\x7F]/g, '')
      // Handle blockquotes
      .replace(/>\s*(.*?)\n/g, '$1\n')
      // Clean up multiple newlines
      .split('\n')
      .filter(line => line.trim())
      .join('\n\n');
  };

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const fadeAnim = fadeAnims.current.get(item.id) || new Animated.Value(1);
    const messageContent = item.role === 'assistant' ? formatAIMessage(item.content) : item.content;

    const handleLongPress = async () => {
      await Clipboard.setStringAsync(item.content);
      // Optional: Show feedback
      Alert.alert('Copied to clipboard');
    };

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          item.role === 'user' ? styles.userMessage : styles.assistantMessage,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
            backgroundColor: item.role === 'user' ? theme.userMessage : theme.assistantMessage
          },
        ]}
      >
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={500}
        >
          <Text style={[
            styles.messageText,
            item.role === 'assistant' && styles.assistantMessageText,
            { color: item.role === 'user' ? '#FFFFFF' : theme.assistantText }
          ]}>
            {messageContent}
          </Text>
          <Text style={[styles.timestamp, { color: theme.text + '80' }]}>
            {formatTime(item.created_at)}
          </Text>
        </Pressable>
        {item.failed && (
          <View>
            <Text style={styles.retryCount}>
              Failed after {item.retryCount} {item.retryCount === 1 ? 'attempt' : 'attempts'}
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => retryMessage(item)}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    );
  }, [theme]);

  const renderStructuredResponse = (response: StructuredResponse) => (
    <View style={styles.structuredResponse}>
      <Text style={styles.sectionTitle}>Legal Issues:</Text>
      {response.analysis.legalIssues.map((issue, i) => (
        <Text key={i}>• {issue}</Text>
      ))}
      
      <Text style={styles.sectionTitle}>Relevant Cases:</Text>
      {response.analysis.relevantCases.map((legalCase, i) => (
        <View key={i}>
          <Text style={styles.caseName}>{legalCase.name}</Text>
          <Text style={styles.citation}>{legalCase.citation}</Text>
          <Text>{legalCase.relevance}</Text>
        </View>
      ))}
      
      <Text style={styles.sectionTitle}>Recommendation:</Text>
      <Text>{response.analysis.recommendation}</Text>
      
      <Text style={styles.confidence}>
        Confidence: {(response.analysis.confidence * 100).toFixed(1)}%
      </Text>
    </View>
  );

  const updateThreadTitle = async (threadId: string, firstMessage: string) => {
    try {
      const { error } = await supabase
        .from('threads')
        .update({ title: firstMessage.slice(0, 50) })
        .eq('id', threadId);
      
      if (error) throw error;
      
      // Update local state too
      setCurrentThread(prev => 
        prev ? { ...prev, title: firstMessage.slice(0, 50) } : prev
      );
    } catch (err) {
      console.error('Error updating thread title:', err);
    }
  };

  // Add keyboard avoiding offset based on device
  const keyboardOffset = Platform.select({
    ios: 90,
    android: 0,
    default: 0,
  });

  // Add retryMessage function
  const retryMessage = async (message: Message, attempt = 0) => {
    if (attempt >= 4) {
      setError('Message failed after multiple attempts');
      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { ...msg, failed: true, pending: false, retryCount: attempt } 
          : msg
      ));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (attempt > 0) {
        const delay = getBackoffDelay(attempt);
        await sleep(delay);
      }

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
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get AI response');
      }

      const aiResponse = await response.json();
      const assistantMessage = aiResponse.choices[0].message.content;

      // Save to Supabase
      const { error } = await supabase
        .from('messages')
        .insert([{
          content: message.content,
          role: message.role as 'user' | 'assistant',
          user_id: session?.user.id,
          thread_id: message.thread_id,
        }]);

      if (error) throw error;

      // Update UI
      setMessages(prev => prev.map(msg => 
        msg.id === message.id 
          ? { ...msg, failed: false, pending: false, retryCount: attempt } 
          : msg
      ));

    } catch (err) {
      console.error(`Retry attempt ${attempt + 1} failed:`, err);
      // Retry with exponential backoff
      return retryMessage(message, attempt + 1);
    } finally {
      setIsLoading(false);
    }
  };

  // Add effect to sync pending messages when coming online
  useEffect(() => {
    if (isOnline) {
      syncPendingMessages();
    }
  }, [isOnline]);

  const syncPendingMessages = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pendingKeys = keys.filter(key => key.startsWith('pending_message_'));
      
      for (const key of pendingKeys) {
        const message = JSON.parse(await AsyncStorage.getItem(key) || '');
        await retryMessage(message);
        await AsyncStorage.removeItem(key);
      }
    } catch (err) {
      console.error('Error syncing pending messages:', err);
    }
  };

  // Add offline banner
  const OfflineBanner = () => (
    <View style={styles.offlineBanner}>
      <Ionicons name="cloud-offline" size={20} color="#fff" />
      <Text style={styles.offlineText}>You're offline. Messages will be sent when you're back online.</Text>
    </View>
  );

  // Create themed styles using useMemo
  const themedStyles = useMemo(() => ({
    loadingContainer: {
      padding: 16,
      alignItems: 'flex-start' as const,
    },
    typingIndicator: {
      flexDirection: 'row' as const,
      padding: 8,
      borderRadius: 20,
      backgroundColor: theme.assistantMessage,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.text,
      marginHorizontal: 2,
    },
    loadingText: {
      color: theme.text,
      marginTop: 4,
      fontSize: 12,
    },
  }), [theme]);

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10A37F" />
      </View>
    );
  }

  if (!session || !currentThread) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10A37F" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        {!isOnline && <OfflineBanner />}
        <KeyboardAvoidingView 
          style={{ flex: 1, backgroundColor: theme.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardOffset}
        >
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
            contentContainerStyle={styles.messagesList}
            style={{ flex: 1 }}
            inverted={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          <View style={[styles.inputContainer, { backgroundColor: theme.background }]}>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.inputBackground,
                color: theme.text,
                fontFamily: 'Avenir-Medium'
              }]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask a law school or bar prep question..."
              placeholderTextColor={theme.text + '80'}
              multiline
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: !input.trim() || isLoading ? theme.inputBackground : '#10A37F' }
              ]}
              onPress={sendMessage}
              disabled={!input.trim() || isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name="send"
                  size={24}
                  color={!input.trim() || isLoading ? theme.text + '40' : '#FFFFFF'}
                />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#ff000020',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesList: {
    padding: 16,
    paddingTop: 8,
  },
  messageContainer: {
    maxWidth: '85%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Avenir-Medium',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  input: {
    flex: 1,
    borderRadius: 24,
    padding: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginRight: 8,
    fontFamily: 'Avenir-Medium',
    minHeight: 48,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  structuredResponse: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  caseName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  citation: {
    fontSize: 14,
    marginBottom: 4,
  },
  confidence: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  retryButton: {
    padding: 8,
    backgroundColor: '#ff000020',
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  retryText: {
    color: '#ff0000',
    fontSize: 14,
  },
  offlineBanner: {
    backgroundColor: '#FF9500',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 14,
  },
  retryCount: {
    color: '#ff0000',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'right',
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  loadingIndicatorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assistantMessageText: {
    lineHeight: 24,
  },
});