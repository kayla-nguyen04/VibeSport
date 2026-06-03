import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { forgotPasswordRequest, googleLoginRequest, loginRequest, registerRequest, updateProfileRequest } from '../services/authApi';

const AUTH_STORAGE_KEY = 'vibesport_mobile_auth_session';

export const hydrateSession = createAsyncThunk('auth/hydrateSession', async (_, { rejectWithValue }) => {
  try {
    const savedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    return savedSession ? JSON.parse(savedSession) : null;
  } catch (error) {
    return rejectWithValue(error.message || 'Không thể tải phiên đăng nhập.');
  }
});

export const registerUser = createAsyncThunk('auth/registerUser', async (payload, { rejectWithValue }) => {
  try {
    return await registerRequest(payload);
  } catch (error) {
    return rejectWithValue(error.message || 'Đăng ký thất bại.');
  }
});

export const loginUser = createAsyncThunk('auth/loginUser', async (payload, { rejectWithValue }) => {
  try {
    const session = await loginRequest(payload);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch (error) {
    return rejectWithValue(error.message || 'Đăng nhập thất bại.');
  }
});

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
});

export const forgotPasswordUser = createAsyncThunk('auth/forgotPasswordUser', async (payload, { rejectWithValue }) => {
  try {
    return await forgotPasswordRequest(payload);
  } catch (error) {
    return rejectWithValue(error.message || 'Không thể đặt lại mật khẩu.');
  }
});

export const googleLoginUser = createAsyncThunk('auth/googleLoginUser', async (payload, { rejectWithValue }) => {
  try {
    const session = await googleLoginRequest(payload);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch (error) {
    return rejectWithValue(error.message || 'Đăng nhập Google thất bại.');
  }
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (payload, { rejectWithValue, getState }) => {
  try {
    const responseData = await updateProfileRequest(payload);

    const savedSessionStr = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    const currentState = getState();
    const currentToken = currentState.auth?.token;
    if (savedSessionStr) {
      const session = JSON.parse(savedSessionStr);
      session.user = responseData.user;
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else if (currentToken) {
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: currentToken, user: responseData.user })
      );
    }

    return responseData.user;
  } catch (error) {
    return rejectWithValue(error.message || 'Cập nhật hồ sơ thất bại.');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    loading: false,
    error: null,
    successMessage: null,
    isAuthenticated: false,
    isHydrating: true,
  },
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
    clearAuthFeedback(state) {
      state.error = null;
      state.successMessage = null;
    },
    setAuthError(state, action) {
      state.error = action.payload;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateSession.pending, (state) => {
        state.isHydrating = true;
      })
      .addCase(hydrateSession.fulfilled, (state, action) => {
        state.isHydrating = false;
        state.user = action.payload?.user ?? null;
        state.token = action.payload?.token ?? null;
        state.isAuthenticated = Boolean(action.payload?.token);
        state.error = null;
        state.successMessage = null;
      })
      .addCase(hydrateSession.rejected, (state, action) => {
        state.isHydrating = false;
        state.error = action.payload || 'Không thể tải phiên đăng nhập.';
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message || 'Đăng ký thành công.';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Đăng ký thất bại.';
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Đăng nhập thất bại.';
      })
      .addCase(googleLoginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(googleLoginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(googleLoginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Đăng nhập Google thất bại.';
      })
      .addCase(forgotPasswordUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(forgotPasswordUser.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = action.payload.message || 'Đặt lại mật khẩu thành công.';
      })
      .addCase(forgotPasswordUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Không thể đặt lại mật khẩu.';
      })
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.successMessage = 'Cập nhật hồ sơ thành công.';
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Cập nhật hồ sơ thất bại.';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = null;
        state.successMessage = null;
      });
  },
});

export const { clearAuthError, clearAuthFeedback, setAuthError } = authSlice.actions;
export default authSlice.reducer;
