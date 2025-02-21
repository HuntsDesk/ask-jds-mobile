import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';

export const ChatScreen = () => {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const route = useRoute();
  const threadId = route.params?.threadId;

  useEffect(() => {
    // Load messages for the thread
    const loadMessages = async () => {
      if (threadId) {
        // Load messages for specific thread
        // const threadMessages = await getThreadMessages(threadId);
        // setMessages(threadMessages);
      } else {
        // Load most recent thread or create new one
        // const recentThread = await getMostRecentThread();
        // setMessages(recentThread.messages);
      }
      setLoading(false);
    };

    loadMessages();
  }, [threadId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MessageList messages={messages} />
      <MessageInput onSend={(message) => {
        // Handle sending message
      }} />
    </View>
  );
}; 