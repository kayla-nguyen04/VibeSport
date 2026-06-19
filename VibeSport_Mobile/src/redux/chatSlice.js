import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { logoutUser } from './authSlice';
import {
  acceptConversationRequest,
  blockConversationRequest,
  createOrGetConversationRequest,
  deletePendingMessagesRequest,
  deleteConversationRequest,
  getChatUnreadCountRequest,
  getConversationsRequest,
  getMessagesRequest,
  markConversationReadRequest,
  muteConversationRequest,
  sendMessageRequest,
  unblockConversationRequest,
  unmuteConversationRequest,
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
  async (arg, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await createOrGetConversationRequest(arg, token);
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

export const acceptConversation = createAsyncThunk(
  'chat/acceptConversation',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await acceptConversationRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể xác nhận tin nhắn chờ.');
    }
  }
);

export const blockConversation = createAsyncThunk(
  'chat/blockConversation',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await blockConversationRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể chặn cuộc trò chuyện.');
    }
  }
);

export const unblockConversation = createAsyncThunk(
  'chat/unblockConversation',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await unblockConversationRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể bỏ chặn cuộc trò chuyện.');
    }
  }
);

export const deleteConversation = createAsyncThunk(
  'chat/deleteConversation',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await deleteConversationRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể xóa cuộc trò chuyện.');
    }
  }
);

export const muteConversation = createAsyncThunk(
  'chat/muteConversation',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await muteConversationRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể tắt thông báo.');
    }
  }
);

export const unmuteConversation = createAsyncThunk(
  'chat/unmuteConversation',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await unmuteConversationRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể bật thông báo.');
    }
  }
);

export const deletePendingMessages = createAsyncThunk(
  'chat/deletePendingMessages',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await deletePendingMessagesRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể xóa tin nhắn chờ.');
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
    accepting: false,
    processing: false,
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
      const { conversationId, message, lastMessage, lastMessageAt, conversation } = action.payload;
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

      if (conversation) {
        if (conversationIndex !== -1) {
          state.conversations[conversationIndex] = {
            ...state.conversations[conversationIndex],
            ...conversation,
            lastMessage,
            lastMessageAt,
          };
        } else {
          state.conversations.unshift({ ...conversation, lastMessage, lastMessageAt });
        }
      } else if (conversationIndex !== -1) {
        state.conversations[conversationIndex].lastMessage = lastMessage;
        state.conversations[conversationIndex].lastMessageAt = lastMessageAt;
      }

      const updatedIndex = state.conversations.findIndex((item) => item._id === conversationId);
      if (updatedIndex !== -1) {
        if (isFromOther && !isActive) {
          state.conversations[updatedIndex].unreadCount =
            (state.conversations[updatedIndex].unreadCount || 0) + 1;
          state.unreadCount += 1;
        } else if (isFromOther && isActive) {
          state.conversations[updatedIndex].unreadCount = 0;
        }
        state.conversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      }
    },
    receivePendingMessage(state, action) {
      const { conversationId, message, conversation: convUpdate, lastMessage, lastMessageAt } = action.payload;

      // SINGLE SOURCE OF TRUTH: all messages go to messagesByConversation
      if (!state.messagesByConversation[conversationId]) {
        state.messagesByConversation[conversationId] = [];
      }

      // Normalize pending message and add to store
      const normalizedMsg = {
        ...message,
        _id: message._id || `pending-${message.createdAt || Date.now()}`,
        isPending: true,
      };

      const exists = state.messagesByConversation[conversationId].some((m) => m._id === normalizedMsg._id);
      if (!exists) {
        state.messagesByConversation[conversationId].push(normalizedMsg);
      }

      // Update conversation metadata
      const convIndex = state.conversations.findIndex((c) => c._id === conversationId);
      if (convIndex !== -1) {
        if (lastMessage) state.conversations[convIndex].lastMessage = lastMessage;
        if (lastMessageAt) state.conversations[convIndex].lastMessageAt = lastMessageAt;
        if (convUpdate) {
          state.conversations[convIndex] = { ...state.conversations[convIndex], ...convUpdate };
        }
        state.conversations.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      } else if (convUpdate) {
        state.conversations.unshift({ ...convUpdate, lastMessage, lastMessageAt });
      }
    },
    conversationAccepted(state, action) {
      const { conversationId, conversation } = action.payload;

      // Update conversation metadata only - messages come from acceptConversation.fulfilled
      if (conversation) {
        state.conversations = upsertConversation(state.conversations, conversation);
      } else {
        const index = state.conversations.findIndex((item) => item._id === conversationId);
        if (index !== -1) {
          state.conversations[index].status = 'active';
          state.conversations[index].isPending = false;
          state.conversations[index].canChat = true;
        }
      }
    },
    conversationBlocked(state, action) {
      const { conversationId } = action.payload;
      const index = state.conversations.findIndex((item) => item._id === conversationId);
      if (index !== -1) {
        state.conversations[index].blockedByMe = true;
        state.conversations[index].isHidden = true;
        state.conversations[index].canChat = false;
        state.conversations[index].canSendPending = false;
        state.conversations[index].otherPendingMessages = [];
      }
    },
    conversationUnblocked(state, action) {
      const { conversation } = action.payload;
      if (conversation) {
        state.conversations = upsertConversation(state.conversations, conversation);
      }
    },
    conversationDeleted(state, action) {
      const { conversationId, deletedByUserId } = action.payload;
      const index = state.conversations.findIndex((item) => item._id === conversationId);
      if (index !== -1) {
        state.conversations[index].deletedByMe = true;
        state.conversations[index].isHidden = true;
        state.conversations[index].canChat = false;
        state.conversations[index].canSendPending = false;
        state.conversations[index].otherPendingMessages = [];
      }
    },
    conversationMuted(state, action) {
      const { conversationId } = action.payload;
      const conv = state.conversations.find((item) => item._id === conversationId);
      if (conv) {
        conv.isMuted = true;
      }
    },
    conversationUnmuted(state, action) {
      const { conversationId } = action.payload;
      const conv = state.conversations.find((item) => item._id === conversationId);
      if (conv) {
        conv.isMuted = false;
      }
    },
    pendingMessagesDeletedByOther(state, action) {
      const { conversationId, deletedByUserId } = action.payload;
      const index = state.conversations.findIndex((item) => item._id === conversationId);
      if (index !== -1) {
        state.conversations[index].myPendingCount = 0;
        state.conversations[index].remainingPendingMessages = 0;
        state.conversations[index].canSendPending = false;
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
      state.accepting = false;
      state.processing = false;
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
        const { data, conversation } = action.payload;
        const conversationId = action.meta.arg.conversationId;
        state.messagesByConversation[conversationId] = data || [];
        if (conversation) {
          state.conversations = upsertConversation(state.conversations, conversation);
        }
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
        const conversationId = action.meta.arg.conversationId;

        // Initialize messages array if needed
        if (!state.messagesByConversation[conversationId]) {
          state.messagesByConversation[conversationId] = [];
        }

        if (data) {
          // Real message from Message collection (accepted/active conversation)
          const exists = state.messagesByConversation[conversationId].some((m) => m._id === data._id);
          if (!exists) {
            state.messagesByConversation[conversationId].push(data);
          }
        } 
          // Pending message: add optimistic message (will be replaced by socket update)

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
      .addCase(acceptConversation.pending, (state) => {
        state.accepting = true;
      })
      .addCase(acceptConversation.fulfilled, (state, action) => {
        state.accepting = false;
        const { data } = action.payload;
        state.conversations = upsertConversation(state.conversations, data);

        // Clear messages - UI will refetch from Message collection
        state.messagesByConversation[data._id] = [];
      })
      .addCase(acceptConversation.rejected, (state) => {
        state.accepting = false;
      })
      .addCase(blockConversation.pending, (state) => {
        state.processing = true;
      })
      .addCase(blockConversation.fulfilled, (state) => {
        state.processing = false;
      })
      .addCase(blockConversation.rejected, (state) => {
        state.processing = false;
      })
      .addCase(unblockConversation.pending, (state) => {
        state.processing = true;
      })
      .addCase(unblockConversation.fulfilled, (state, action) => {
        state.processing = false;
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      .addCase(unblockConversation.rejected, (state) => {
        state.processing = false;
      })
      .addCase(deletePendingMessages.pending, (state) => {
        state.processing = true;
      })
      .addCase(deletePendingMessages.fulfilled, (state) => {
        state.processing = false;
      })
      .addCase(deletePendingMessages.rejected, (state) => {
        state.processing = false;
      })
      .addCase(deleteConversation.pending, (state) => {
        state.processing = true;
      })
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.processing = false;
        // API returns { success, conversationId } or action.meta.arg is the conversationId
        const conversationId = action.payload?.conversationId || action.meta.arg;
        if (conversationId) {
          state.conversations = state.conversations.filter((c) => c._id !== conversationId);
          delete state.messagesByConversation[conversationId];
        }
      })
      .addCase(deleteConversation.rejected, (state) => {
        state.processing = false;
      })
      .addCase(muteConversation.fulfilled, (state, action) => {
        const conversationId = action.payload?.conversationId || action.meta.arg;
        if (conversationId) {
          const conv = state.conversations.find((c) => c._id === conversationId);
          if (conv) {
            conv.isMuted = true;
          }
        }
      })
      .addCase(unmuteConversation.fulfilled, (state, action) => {
        const conversationId = action.payload?.conversationId || action.meta.arg;
        if (conversationId) {
          const conv = state.conversations.find((c) => c._id === conversationId);
          if (conv) {
            conv.isMuted = false;
          }
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
        state.accepting = false;
        state.processing = false;
        state.error = null;
      });
  },
});

export const {
  setActiveConversation,
  setChatUnreadCount,
  receiveMessage,
  receivePendingMessage,
  conversationAccepted,
  conversationBlocked,
  conversationUnblocked,
  conversationDeleted,
  conversationMuted,
  conversationUnmuted,
  pendingMessagesDeletedByOther,
  resetChat,
} = chatSlice.actions;
export default chatSlice.reducer;
