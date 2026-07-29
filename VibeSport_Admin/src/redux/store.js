import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import adminUsersReducer from './slices/adminUsersSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    adminUsers: adminUsersReducer,
  },
});