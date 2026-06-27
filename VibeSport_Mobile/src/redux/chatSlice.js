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
  sendImageMessageRequest,
  unblockConversationRequest,
  unmuteConversationRequest,
  updateGroupInfoRequest,
  addParticipantsRequest,
  leaveGroupRequest,
  removeParticipantRequest,
  updateMemberRoleRequest,
  muteMemberRequest,
  unmuteMemberRequest,
  updateNicknameRequest,
  generateInviteLinkRequest,
  revokeInviteLinkRequest,
  getInviteLinkInfoRequest,
  joinViaInviteLinkRequest,
  approveJoinRequestRequest,
  rejectJoinRequestRequest,
  requestToJoinGroupRequest,
  requestAddMemberRequest,
  pinMessageRequest,
  unpinMessageRequest,
  recallMessageRequest,
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

export const updateGroupInfo = createAsyncThunk(
  'chat/updateGroupInfo',
  async ({ conversationId, formData }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await updateGroupInfoRequest(conversationId, formData, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể cập nhật thông tin nhóm.');
    }
  }
);

export const addParticipants = createAsyncThunk(
  'chat/addParticipants',
  async ({ conversationId, userIds }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await addParticipantsRequest(conversationId, userIds, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể thêm thành viên vào nhóm.');
    }
  }
);

export const requestAddMember = createAsyncThunk(
  'chat/requestAddMember',
  async ({ conversationId, userId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await requestAddMemberRequest(conversationId, userId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể gửi yêu cầu thêm thành viên.');
    }
  }
);

export const leaveGroup = createAsyncThunk(
  'chat/leaveGroup',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await leaveGroupRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể rời khỏi nhóm.');
    }
  }
);

export const removeParticipant = createAsyncThunk(
  'chat/removeParticipant',
  async ({ conversationId, userId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await removeParticipantRequest(conversationId, userId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể xóa thành viên khỏi nhóm.');
    }
  }
);

export const updateMemberRole = createAsyncThunk(
  'chat/updateMemberRole',
  async ({ conversationId, userId, role }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await updateMemberRoleRequest(conversationId, userId, role, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể cập nhật vai trò thành viên.');
    }
  }
);

export const muteMember = createAsyncThunk(
  'chat/muteMember',
  async ({ conversationId, userId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await muteMemberRequest(conversationId, userId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể cấm chat thành viên.');
    }
  }
);

export const unmuteMember = createAsyncThunk(
  'chat/unmuteMember',
  async ({ conversationId, userId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await unmuteMemberRequest(conversationId, userId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể bỏ cấm chat thành viên.');
    }
  }
);

export const updateNickname = createAsyncThunk(
  'chat/updateNickname',
  async ({ conversationId, userId, nickname }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await updateNicknameRequest(conversationId, userId, nickname, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể cập nhật biệt danh.');
    }
  }
);

export const generateInviteLink = createAsyncThunk(
  'chat/generateInviteLink',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await generateInviteLinkRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể tạo link mời.');
    }
  }
);

export const revokeInviteLink = createAsyncThunk(
  'chat/revokeInviteLink',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await revokeInviteLinkRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể vô hiệu hóa link mời.');
    }
  }
);

export const getInviteLinkInfo = createAsyncThunk(
  'chat/getInviteLinkInfo',
  async (code, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await getInviteLinkInfoRequest(code, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể lấy thông tin link mời.');
    }
  }
);

export const joinViaInviteLink = createAsyncThunk(
  'chat/joinViaInviteLink',
  async (code, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await joinViaInviteLinkRequest(code, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể tham gia nhóm qua link mời.');
    }
  }
);

export const sendImageMessage = createAsyncThunk(
  'chat/sendImageMessage',
  async ({ conversationId, formData }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await sendImageMessageRequest(conversationId, formData, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể gửi ảnh.');
    }
  }
);

export const approveJoinRequest = createAsyncThunk(
  'chat/approveJoinRequest',
  async ({ conversationId, userId, requesterId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await approveJoinRequestRequest(conversationId, userId, requesterId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể phê duyệt thành viên.');
    }
  }
);

export const rejectJoinRequest = createAsyncThunk(
  'chat/rejectJoinRequest',
  async ({ conversationId, userId, requesterId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await rejectJoinRequestRequest(conversationId, userId, requesterId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể từ chối yêu cầu.');
    }
  }
);

export const requestToJoinGroup = createAsyncThunk(
  'chat/requestToJoinGroup',
  async (conversationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await requestToJoinGroupRequest(conversationId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể gửi yêu cầu tham gia.');
    }
  }
);

export const pinMessage = createAsyncThunk(
  'chat/pinMessage',
  async ({ conversationId, messageId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await pinMessageRequest(conversationId, messageId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể ghim tin nhắn.');
    }
  }
);

export const unpinMessage = createAsyncThunk(
  'chat/unpinMessage',
  async ({ conversationId, messageId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await unpinMessageRequest(conversationId, messageId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể bỏ ghim tin nhắn.');
    }
  }
);

export const recallMessage = createAsyncThunk(
  'chat/recallMessage',
  async ({ messageId }, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await recallMessageRequest(messageId, token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể thu hồi tin nhắn.');
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
    groupUpdated(state, action) {
      const { conversationId, conversation } = action.payload;
      const index = state.conversations.findIndex((item) => item._id === conversationId);
      if (index !== -1) {
        if (!conversation) {
          state.conversations = state.conversations.filter((c) => c._id !== conversationId);
          delete state.messagesByConversation[conversationId];
          if (state.activeConversationId === conversationId) {
            state.activeConversationId = null;
          }
        } else {
          state.conversations[index] = {
            ...state.conversations[index],
            ...conversation,
          };
        }
      }
    },
    memberMuted(state, action) {
      const { conversationId } = action.payload;
      const conv = state.conversations.find(c => c._id === conversationId);
      if (conv) {
        conv.isMutedMember = true;
        conv.canChat = false;
      }
    },
    memberUnmuted(state, action) {
      const { conversationId } = action.payload;
      const conv = state.conversations.find(c => c._id === conversationId);
      if (conv) {
        conv.isMutedMember = false;
        conv.canChat = true;
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
    joinRequestUpdated(state, action) {
      const { conversation } = action.payload;
      if (!conversation) return;
      const index = state.conversations.findIndex((item) => item._id === conversation._id);
      if (index !== -1) {
        state.conversations[index] = { ...state.conversations[index], ...conversation };
      }
    },
    messageRecalled(state, action) {
      const { conversationId, messageId } = action.payload;
      const messages = state.messagesByConversation[conversationId] || [];
      const index = messages.findIndex((m) => m._id === messageId);
      if (index !== -1) {
        messages[index] = {
          ...messages[index],
          isRecalled: true,
          content: 'Tin nhắn đã bị thu hồi',
          mediaUrl: null,
          type: 'text',
        };
      }

      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv) {
        const msg = messages.find((m) => m._id === messageId);
        // If this was the last message, update lastMessage
        if (msg && conv.lastMessageAt === msg.createdAt) {
          conv.lastMessage = 'Tin nhắn đã bị thu hồi';
        }
      }
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
      .addCase(updateGroupInfo.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      .addCase(addParticipants.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      .addCase(leaveGroup.fulfilled, (state, action) => {
        const conversationId = action.meta.arg;
        state.conversations = state.conversations.filter((c) => c._id !== conversationId);
        delete state.messagesByConversation[conversationId];
        if (state.activeConversationId === conversationId) {
          state.activeConversationId = null;
        }
      })
      .addCase(removeParticipant.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      .addCase(updateMemberRole.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      .addCase(muteMember.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      .addCase(unmuteMember.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      .addCase(updateNickname.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      .addCase(generateInviteLink.fulfilled, (state, action) => {
        const conversationId = action.meta.arg;
        const inviteData = action.payload?.data;
        if (conversationId && inviteData) {
          const conv = state.conversations.find(c => c._id === conversationId);
          if (conv) {
            conv.inviteCode = inviteData.inviteCode;
            conv.inviteLinkEnabled = inviteData.inviteLinkEnabled;
          }
        }
      })
      .addCase(revokeInviteLink.fulfilled, (state, action) => {
        const conversationId = action.meta.arg;
        if (conversationId) {
          const conv = state.conversations.find(c => c._id === conversationId);
          if (conv) {
            conv.inviteCode = null;
            conv.inviteLinkEnabled = false;
          }
        }
      })
      .addCase(joinViaInviteLink.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) {
          state.conversations = upsertConversation(state.conversations, data);
        }
      })
      // Gửi ảnh chat
      .addCase(sendImageMessage.pending, (state) => {
        state.sending = true;
      })
      .addCase(sendImageMessage.fulfilled, (state, action) => {
        state.sending = false;
        const { data, conversation } = action.payload;
        const conversationId = action.meta.arg.conversationId;
        if (!state.messagesByConversation[conversationId]) {
          state.messagesByConversation[conversationId] = [];
        }
        if (data) {
          const exists = state.messagesByConversation[conversationId].some((m) => m._id === data._id);
          if (!exists) state.messagesByConversation[conversationId].push(data);
        }
        if (conversation) {
          state.conversations = upsertConversation(state.conversations, conversation);
        }
      })
      .addCase(sendImageMessage.rejected, (state) => {
        state.sending = false;
      })
      // Duyệt/từ chối yêu cầu gia nhóm
      .addCase(approveJoinRequest.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) state.conversations = upsertConversation(state.conversations, data);
      })
      .addCase(rejectJoinRequest.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) state.conversations = upsertConversation(state.conversations, data);
      })
      .addCase(pinMessage.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) state.conversations = upsertConversation(state.conversations, data);
      })
      .addCase(unpinMessage.fulfilled, (state, action) => {
        const data = action.payload?.data;
        if (data) state.conversations = upsertConversation(state.conversations, data);
      })
      .addCase(recallMessage.fulfilled, (state, action) => {
        const message = action.payload.data;
        if (!message) return;
        const conversationId = message.conversationId;
        const messages = state.messagesByConversation[conversationId] || [];
        const index = messages.findIndex((m) => m._id === message._id);
        if (index !== -1) {
          messages[index] = { ...messages[index], ...message };
        }
        const conv = state.conversations.find((c) => c._id === conversationId);
        if (conv && conv.lastMessageAt === message.createdAt) {
          conv.lastMessage = 'Tin nhắn đã bị thu hồi';
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
  memberMuted,
  memberUnmuted,
  pendingMessagesDeletedByOther,
  groupUpdated,
  resetChat,
  joinRequestUpdated,
  messageRecalled,
} = chatSlice.actions;
export default chatSlice.reducer;
