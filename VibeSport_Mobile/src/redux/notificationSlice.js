import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getNotificationsRequest,
  getUnreadCountRequest,
  markAllReadRequest,
  markOneReadRequest,
} from '../services/notificationApi';
import { logoutUser } from './authSlice';

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async ({ page = 1, limit = 20 } = {}, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await getNotificationsRequest(token, page, limit);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể tải thông báo.');
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await getUnreadCountRequest(token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể lấy số thông báo chưa đọc.');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllNotificationsRead',
  async (_, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await markAllReadRequest(token);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể đánh dấu đã đọc tất cả.');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markNotificationRead',
  async (notificationId, { rejectWithValue, getState }) => {
    try {
      const token = getState().auth.token;
      return await markOneReadRequest(token, notificationId);
    } catch (error) {
      return rejectWithValue(error.message || 'Không thể đánh dấu đã đọc.');
    }
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
  },
  reducers: {
    addNotification(state, action) {
      // Tránh trùng lặp id
      const exists = state.notifications.some((n) => n._id === action.payload._id);
      if (!exists) {
        state.notifications.unshift(action.payload);
        state.unreadCount += 1;
      }
    },
    setUnreadCount(state, action) {
      state.unreadCount = action.payload;
    },
    resetNotifications(state) {
      state.notifications = [];
      state.unreadCount = 0;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.data || [];
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch unread count
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.unreadCount || 0;
      })
      // Mark all read
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.unreadCount = 0;
        state.notifications.forEach((n) => {
          n.read = true;
        });
      })
      // Mark single read
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const updated = action.payload.data;
        if (updated) {
          const index = state.notifications.findIndex((n) => n._id === updated._id);
          if (index !== -1) {
            state.notifications[index].read = true;
          }
        }
        // Giảm unreadCount nếu nó lớn hơn 0
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.notifications = [];
        state.unreadCount = 0;
        state.loading = false;
        state.error = null;
      });
  },
});

export const { addNotification, setUnreadCount, resetNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
