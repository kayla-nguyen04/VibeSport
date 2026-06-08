import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createPostRequest,
  deletePostRequest,
  getPostsRequest,
  likePostRequest,
  commentPostRequest,
  updatePostRequest,
} from '../services/postApi';

// ─── ASYNC THUNKS ──────────────────────────────────────────

// Fetch posts paginated
export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async ({ page, limit }, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await getPostsRequest(page, limit, token);
      return response; // { success, data, page, limit }
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// Create a post
export const createPost = createAsyncThunk(
  'posts/createPost',
  async (formData, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await createPostRequest(formData, token);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// Like / unlike post (optimistic toggle)
export const likePost = createAsyncThunk(
  'posts/likePost',
  async (postId, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await likePostRequest(postId, token);
      return { postId, liked: response.liked, likesCount: response.likesCount };
    } catch (err) {
      return rejectWithValue({ postId, error: err.message });
    }
  }
);

// Comment on post
export const commentPost = createAsyncThunk(
  'posts/commentPost',
  async ({ postId, content }, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await commentPostRequest(postId, content, token);
      return { postId, comment: response.data, commentsCount: response.commentsCount };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// Delete post
export const deletePost = createAsyncThunk(
  'posts/deletePost',
  async (postId, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      await deletePostRequest(postId, token);
      return postId;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// Update post
export const updatePost = createAsyncThunk(
  'posts/updatePost',
  async ({ postId, formData }, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await updatePostRequest(postId, formData, token);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ─── POST SLICE ──────────────────────────────────────────────

const postSlice = createSlice({
  name: 'posts',
  initialState: {
    posts: [],
    page: 1,
    loading: false,
    refreshing: false,
    creating: false,
    hasMore: true,
    error: null,
  },
  reducers: {
    resetFeed: (state) => {
      state.posts = [];
      state.page = 1;
      state.hasMore = true;
      state.error = null;
    },
    updateCommentCount: (state, action) => {
      const { postId, commentsCount } = action.payload;
      const post = state.posts.find((p) => p._id === postId);
      if (post) {
        post.commentsCount = commentsCount;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Posts
      .addCase(fetchPosts.pending, (state, action) => {
        if (action.meta.arg.page === 1) {
          state.refreshing = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        const { data, page } = action.payload;
        state.loading = false;
        state.refreshing = false;
        if (page === 1) {
          state.posts = data;
        } else {
          // Filter duplicates
          const existingIds = new Set(state.posts.map((p) => p._id));
          const newPosts = data.filter((p) => !existingIds.has(p._id));
          state.posts = [...state.posts, ...newPosts];
        }
        state.page = page;
        state.hasMore = data.length > 0;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        state.error = action.payload;
      })

      // Create Post
      .addCase(createPost.pending, (state) => {
        state.creating = true;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.creating = false;
        state.posts = [action.payload, ...state.posts];
      })
      .addCase(createPost.rejected, (state) => {
        state.creating = false;
      })

      // Like Post (Optimistic update)
      .addCase(likePost.pending, (state, action) => {
        const postId = action.meta.arg;
        const post = state.posts.find((p) => p._id === postId);
        if (post) {
          post.isLiked = !post.isLiked;
          post.likesCount += post.isLiked ? 1 : -1;
        }
      })
      .addCase(likePost.fulfilled, (state, action) => {
        const { postId, liked, likesCount } = action.payload;
        const post = state.posts.find((p) => p._id === postId);
        if (post) {
          post.isLiked = liked;
          post.likesCount = likesCount;
        }
      })
      .addCase(likePost.rejected, (state, action) => {
        // Rollback state on error
        const { postId } = action.payload || {};
        const post = state.posts.find((p) => p._id === postId);
        if (post) {
          post.isLiked = !post.isLiked;
          post.likesCount += post.isLiked ? 1 : -1;
        }
      })

      // Comment Post
      .addCase(commentPost.fulfilled, (state, action) => {
        const { postId, commentsCount } = action.payload;
        const post = state.posts.find((p) => p._id === postId);
        if (post) {
          post.commentsCount = commentsCount;
        }
      })

      // Delete Post
      .addCase(deletePost.fulfilled, (state, action) => {
        const postId = action.payload;
        state.posts = state.posts.filter((p) => p._id !== postId);
      })

      // Update Post
      .addCase(updatePost.fulfilled, (state, action) => {
        const updated = action.payload;
        if (!updated) return;
        const idx = state.posts.findIndex((p) => p._id === updated._id);
        if (idx !== -1) {
          state.posts[idx] = { ...state.posts[idx], ...updated };
        }
      });
  },
});

export const { resetFeed, updateCommentCount } = postSlice.actions;
export default postSlice.reducer;
