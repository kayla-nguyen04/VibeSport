import { configureStore } from '@reduxjs/toolkit';

import authReducer from './authSlice';
import postReducer from './postSlice';
import notificationReducer from './notificationSlice';
import chatReducer from './chatSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    posts: postReducer,
    notifications: notificationReducer,
    chat: chatReducer,
  },
});

