import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { logoutUser } from './authSlice';
import {
  createOrGetConversationRequest,
  getChatUnreadCountRequest,
  getConversationsRequest,
  getMessagesRequest,
  markConversationReadRequest,
  sendMessageRequest,
} from '../services/chatApi';

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (_, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await getConversationsRequest(token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể tải hội thoại.');
    }
  }
);

export const fetchChatUnreadCount = createAsyncThunk(
  'chat/fetchChatUnreadCount',
  async (_, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await getChatUnreadCountRequest(token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể lấy số tin nhắn chưa đọc.');
    }
  }
);

export const openConversation = createAsyncThunk(
  'chat/openConversation',
  async (recipientId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await createOrGetConversationRequest(recipientId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể mở hội thoại.');
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ conversationId, page = 1 }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await getMessagesRequest(conversationId, token, page);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể tải tin nhắn.');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, content }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await sendMessageRequest(conversationId, content, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể gửi tin nhắn.');
    }
  }
);

export const markConversationRead = createAsyncThunk(
  'chat/markConversationRead',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      await markConversationReadRequest(conversationId, token);
      return conversationId;
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể đánh dấu đã đọc.');
    }
  }
);

const upsertConversation = (conversations, conversation) => {
  const index = conversations.findIndex((item) => item._id === conversation._id);
  if (index === -1) {
    return [conversation, ...conversations];
  }
  const next = [...conversations];
  next[index] = { ...next[index], ...conversation };
  next.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  return next;
};

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    activeConversationId: null,
  conversations: [],
    messagesByConversation: {},
    unreadCount: 0,
    loadingConversations: false,
    loadingMessages: false,
    sending: false,
    error: null,
  },
  reducers: {
    setActiveConversation(state, action) {
      state.activeConversationId = action.payload;
    },
    setChatUnreadCount(state, action) {
      state.unreadCount = action.payload || 0;
    },
    receiveMessage(state, action) {
      const { conversationId, message, lastMessage, lastMessageAt } = action.payload;
      const currentUserId = action.payload.currentUserId;

      if (!state.messagesByConversation[conversationId]) {
        state.messagesByConversation[conversationId] = [];
      }

      const exists = state.messagesByConversation[conversationId].some((item) => item._id === message._id);
      if (!exists) {
        state.messagesByConversation[conversationId].push(message);
      }

      const conversationIndex = state.conversations.findIndex((item) => item._id === conversationId);
      const isActive = state.activeConversationId === conversationId;
      const isFromOther = String(message.senderId?._id || message.senderId) !== String(currentUserId);

      if (conversationIndex !== -1) {
        state.conversations[conversationIndex].lastMessage = lastMessage;
        state.conversations[conversationIndex].lastMessageAt = lastMessageAt;
        if (isFromOther && !isActive) {
          state.conversations[conversationIndex].unreadCount += 1;
          state.unreadCount += 1;
        } else if (isFromOther && isActive) {
          state.conversations[conversationIndex].unreadCount = 0;
        }
        state.conversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      }
    },
    resetChat(state) {
      state.activeConversationId = null;
      state.conversations = [];
      state.messagesByConversation = {};
      state.unreadCount = 0;
      state.loadingConversations = false;
      state.loadingMessages = false;
      state.sending = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loadingConversations = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loadingConversations = false;
        state.conversations = action.payload.data || [];
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loadingConversations = false;
        state.error = action.payload;
      })
      .addCase(fetchChatUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.unreadCount || 0;
      })
      .addCase(openConversation.fulfilled, (state, action) => {
        state.conversations = upsertConversation(state.conversations, action.payload.data);
      })
      .addCase(fetchMessages.pending, (state) => {
        state.loadingMessages = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.loadingMessages = false;
        const { data } = action.payload;
        const conversationId = action.meta.arg.conversationId;
        state.messagesByConversation[conversationId] = data || [];
      })
      .addCase(fetchMessages.rejected, (state) => {
        state.loadingMessages = false;
      })
      .addCase(sendMessage.pending, (state) => {
        state.sending = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false;
        const { data, conversation } = action.payload;
        const conversationId = data.conversationId;

        if (!state.messagesByConversation[conversationId]) {
          state.messagesByConversation[conversationId] = [];
        }
        state.messagesByConversation[conversationId].push(data);

        if (conversation) {
          state.conversations = upsertConversation(state.conversations, conversation);
        }
      })
      .addCase(sendMessage.rejected, (state) => {
        state.sending = false;
      })
      .addCase(markConversationRead.fulfilled, (state, action) => {
        const conversationId = action.payload;
        const conversation = state.conversations.find((item) => item._id === conversationId);
        if (conversation?.unreadCount) {
          state.unreadCount = Math.max(0, state.unreadCount - conversation.unreadCount);
          conversation.unreadCount = 0;
        }
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.activeConversationId = null;
        state.conversations = [];
        state.messagesByConversation = {};
        state.unreadCount = 0;
        state.loadingConversations = false;
        state.loadingMessages = false;
        state.sending = false;
        state.error = null;
      });
  },
});

export const { setActiveConversation, setChatUnreadCount, receiveMessage, resetChat } = chatSlice.actions;
export default chatSlice.reducer;
