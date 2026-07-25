import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = 'http://localhost:4000/api/admin/users';

export const fetchUsers = createAsyncThunk(
  'adminUsers/fetchUsers',
  async ({ page = 1, limit = 10, search = '', status = '', sortBy = '' }, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const response = await axios.get(`${API_URL}?page=${page}&limit=${limit}&search=${search}&status=${status}&sortBy=${sortBy}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Lỗi khi tải danh sách người dùng');
    }
  }
);

export const updateUserRole = createAsyncThunk(
  'adminUsers/updateRole',
  async ({ id, role }, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const response = await axios.patch(`${API_URL}/${id}/role`, { role }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Lỗi khi cập nhật quyền');
    }
  }
);

export const lockUnlockUser = createAsyncThunk(
  'adminUsers/lockUnlock',
  async ({ id, isLocked }, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const response = await axios.patch(`${API_URL}/${id}/lock`, { isLocked }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Lỗi khi khóa/mở khóa người dùng');
    }
  }
);

export const fetchUserReports = createAsyncThunk(
  'adminUsers/fetchUserReports',
  async ({ id }, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const response = await axios.get(`${API_URL}/${id}/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Lỗi khi tải danh sách báo cáo');
    }
  }
);

export const resolveUserReports = createAsyncThunk(
  'adminUsers/resolveUserReports',
  async ({ id }, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const response = await axios.patch(`${API_URL}/${id}/resolve-reports`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Lỗi khi xử lý báo cáo');
    }
  }
);

const adminUsersSlice = createSlice({
  name: 'adminUsers',
  initialState: {
    users: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1
    },
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Users
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update Role
      .addCase(updateUserRole.fulfilled, (state, action) => {
        const updatedUser = action.payload.data;
        const index = state.users.findIndex(u => u._id === updatedUser._id);
        if (index !== -1) {
          state.users[index] = updatedUser;
        }
      })
      // Lock/Unlock User
      .addCase(lockUnlockUser.fulfilled, (state, action) => {
        const updatedUser = action.payload.data;
        const index = state.users.findIndex(u => u._id === updatedUser._id);
        if (index !== -1) {
          state.users[index] = updatedUser;
        }
      })
      // Resolve Reports
      .addCase(resolveUserReports.fulfilled, (state, action) => {
        const updatedUser = action.payload.data;
        const index = state.users.findIndex(u => u._id === updatedUser._id);
        if (index !== -1) {
          state.users[index] = updatedUser;
        }
      });
  }
});

export const { clearError } = adminUsersSlice.actions;
export default adminUsersSlice.reducer;
