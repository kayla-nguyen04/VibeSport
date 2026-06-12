import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  createPostRequest,
  deletePostRequest,
  getPostsRequest,
  likePostRequest,
  unlikePostRequest,
  commentPostRequest,
  updatePostRequest,
  savePostRequest,
  unsavePostRequest,
  getSavedPostsRequest,
} from '../services/postApi';

const normalizePost = (post) => ({
  isLiked: false,
  reactionType: null,
  topReactions: [],
  isSaved: false,
  ...post,
});

const getPostIdFromArg = (arg) => (typeof arg === 'string' ? arg : arg?.postId);
const getReactionTypeFromArg = (arg) => (typeof arg === 'string' ? 'like' : arg?.reactionType || 'like');

const snapshotPostInteraction = (post) => post
  ? {
      isLiked: Boolean(post.isLiked),
      likesCount: post.likesCount || 0,
      reactionType: post.reactionType || null,
      topReactions: post.topReactions || [],
      isSaved: Boolean(post.isSaved),
    }
  : null;

const findPostInState = (state, postId) => (
  state.posts.find((post) => post._id === postId)
  || state.savedPosts.find((post) => post._id === postId)
);

const updatePostInCollections = (state, postId, updater) => {
  state.posts.forEach((post) => {
    if (post._id === postId) updater(post);
  });
  state.savedPosts.forEach((post) => {
    if (post._id === postId) updater(post);
  });
};

const restorePostInteraction = (state, postId, snapshot) => {
  if (!snapshot) return;
  updatePostInCollections(state, postId, (post) => {
    post.isLiked = snapshot.isLiked;
    post.likesCount = snapshot.likesCount;
    post.reactionType = snapshot.reactionType;
    post.topReactions = snapshot.topReactions;
    post.isSaved = snapshot.isSaved;
  });
};

const pushTopReaction = (topReactions = [], reactionType) => {
  if (!reactionType) return topReactions || [];
  const rest = (topReactions || []).filter((item) => item !== reactionType);
  return [reactionType, ...rest].slice(0, 2);
};

export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async ({ page, limit, tag = null }, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await getPostsRequest(page, limit, token, tag);
      return { ...response, tag };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchSavedPosts = createAsyncThunk(
  'posts/fetchSavedPosts',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await getSavedPostsRequest(token);
      return response.data || [];
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

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

export const likePost = createAsyncThunk(
  'posts/likePost',
  async (arg, { getState, rejectWithValue }) => {
    const postId = getPostIdFromArg(arg);
    const reactionType = getReactionTypeFromArg(arg);

    try {
      const token = getState().auth.token;
      const response = await likePostRequest(postId, token, reactionType);
      return {
        postId,
        isLiked: response.isLiked ?? Boolean(response.reactionType),
        reactionType: response.reactionType || null,
        likesCount: response.likesCount,
        topReactions: response.topReactions || [],
      };
    } catch (err) {
      return rejectWithValue({ postId, error: err.message });
    }
  }
);

export const unlikePost = createAsyncThunk(
  'posts/unlikePost',
  async (postId, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const response = await unlikePostRequest(postId, token);
      return {
        postId,
        isLiked: false,
        reactionType: null,
        likesCount: response.likesCount,
        topReactions: response.topReactions || [],
      };
    } catch (err) {
      return rejectWithValue({ postId, error: err.message });
    }
  }
);

export const savePost = createAsyncThunk(
  'posts/savePost',
  async (postId, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      await savePostRequest(postId, token);
      return postId;
    } catch (err) {
      return rejectWithValue({ postId, error: err.message });
    }
  }
);

export const unsavePost = createAsyncThunk(
  'posts/unsavePost',
  async (postId, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      await unsavePostRequest(postId, token);
      return postId;
    } catch (err) {
      return rejectWithValue({ postId, error: err.message });
    }
  }
);

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

const postSlice = createSlice({
  name: 'posts',
  initialState: {
    posts: [],
    savedPosts: [],
    page: 1,
    loading: false,
    refreshing: false,
    savedPostsLoading: false,
    savedPostsRefreshing: false,
    creating: false,
    hasMore: true,
    error: null,
    savedPostsError: null,
    activeTag: null,
    pendingReactions: {},
    pendingSaves: {},
  },
  reducers: {
    setActiveTag: (state, action) => {
      state.activeTag = action.payload || null;
      state.posts = [];
      state.page = 1;
      state.hasMore = true;
    },
    resetFeed: (state) => {
      state.posts = [];
      state.page = 1;
      state.hasMore = true;
      state.error = null;
      state.activeTag = null;
    },
    updateCommentCount: (state, action) => {
      const { postId, commentsCount } = action.payload;
      updatePostInCollections(state, postId, (post) => {
        post.commentsCount = commentsCount;
      });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (state, action) => {
        if (action.meta.arg.page === 1) {
          state.refreshing = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        const { data, page, tag } = action.payload;
        const normalizedPosts = (data || []).map(normalizePost);

        state.loading = false;
        state.refreshing = false;
        state.activeTag = tag || null;
        if (page === 1) {
          state.posts = normalizedPosts;
        } else {
          const existingIds = new Set(state.posts.map((post) => post._id));
          state.posts = [
            ...state.posts,
            ...normalizedPosts.filter((post) => !existingIds.has(post._id)),
          ];
        }
        state.page = page;
        state.hasMore = normalizedPosts.length > 0;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.loading = false;
        state.refreshing = false;
        state.error = action.payload;
      })

      .addCase(fetchSavedPosts.pending, (state) => {
        if (state.savedPosts.length === 0) {
          state.savedPostsLoading = true;
        } else {
          state.savedPostsRefreshing = true;
        }
        state.savedPostsError = null;
      })
      .addCase(fetchSavedPosts.fulfilled, (state, action) => {
        state.savedPostsLoading = false;
        state.savedPostsRefreshing = false;
        state.savedPosts = (action.payload || []).map(normalizePost);
      })
      .addCase(fetchSavedPosts.rejected, (state, action) => {
        state.savedPostsLoading = false;
        state.savedPostsRefreshing = false;
        state.savedPostsError = action.payload;
      })

      .addCase(createPost.pending, (state) => {
        state.creating = true;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.creating = false;
        state.posts = [normalizePost(action.payload), ...state.posts];
      })
      .addCase(createPost.rejected, (state) => {
        state.creating = false;
      })

      .addCase(likePost.pending, (state, action) => {
        const postId = getPostIdFromArg(action.meta.arg);
        const reactionType = getReactionTypeFromArg(action.meta.arg);
        const currentPost = findPostInState(state, postId);

        state.pendingReactions[action.meta.requestId] = {
          postId,
          snapshot: snapshotPostInteraction(currentPost),
        };

        updatePostInCollections(state, postId, (post) => {
          const shouldIncrement = !post.isLiked;
          post.isLiked = true;
          post.reactionType = reactionType;
          post.likesCount = Math.max(0, (post.likesCount || 0) + (shouldIncrement ? 1 : 0));
          post.topReactions = pushTopReaction(post.topReactions, reactionType);
        });
      })
      .addCase(likePost.fulfilled, (state, action) => {
        const { postId, isLiked, reactionType, likesCount, topReactions } = action.payload;
        updatePostInCollections(state, postId, (post) => {
          post.isLiked = isLiked;
          post.reactionType = reactionType;
          post.likesCount = likesCount;
          post.topReactions = topReactions;
        });
        delete state.pendingReactions[action.meta.requestId];
      })
      .addCase(likePost.rejected, (state, action) => {
        const pending = state.pendingReactions[action.meta.requestId];
        restorePostInteraction(state, pending?.postId, pending?.snapshot);
        delete state.pendingReactions[action.meta.requestId];
      })

      .addCase(unlikePost.pending, (state, action) => {
        const postId = action.meta.arg;
        const currentPost = findPostInState(state, postId);

        state.pendingReactions[action.meta.requestId] = {
          postId,
          snapshot: snapshotPostInteraction(currentPost),
        };

        updatePostInCollections(state, postId, (post) => {
          const shouldDecrement = Boolean(post.isLiked);
          post.isLiked = false;
          post.reactionType = null;
          post.likesCount = Math.max(0, (post.likesCount || 0) - (shouldDecrement ? 1 : 0));
        });
      })
      .addCase(unlikePost.fulfilled, (state, action) => {
        const { postId, isLiked, reactionType, likesCount, topReactions } = action.payload;
        updatePostInCollections(state, postId, (post) => {
          post.isLiked = isLiked;
          post.reactionType = reactionType;
          post.likesCount = likesCount;
          post.topReactions = topReactions;
        });
        delete state.pendingReactions[action.meta.requestId];
      })
      .addCase(unlikePost.rejected, (state, action) => {
        const pending = state.pendingReactions[action.meta.requestId];
        restorePostInteraction(state, pending?.postId, pending?.snapshot);
        delete state.pendingReactions[action.meta.requestId];
      })

      .addCase(savePost.pending, (state, action) => {
        const postId = action.meta.arg;
        const currentPost = findPostInState(state, postId);
        state.pendingSaves[action.meta.requestId] = {
          postId,
          isSaved: Boolean(currentPost?.isSaved),
        };
        updatePostInCollections(state, postId, (post) => {
          post.isSaved = true;
        });
      })
      .addCase(savePost.fulfilled, (state, action) => {
        updatePostInCollections(state, action.payload, (post) => {
          post.isSaved = true;
        });
        delete state.pendingSaves[action.meta.requestId];
      })
      .addCase(savePost.rejected, (state, action) => {
        const pending = state.pendingSaves[action.meta.requestId];
        updatePostInCollections(state, pending?.postId, (post) => {
          post.isSaved = pending?.isSaved || false;
        });
        delete state.pendingSaves[action.meta.requestId];
      })

      .addCase(unsavePost.pending, (state, action) => {
        const postId = action.meta.arg;
        const currentPost = findPostInState(state, postId);
        state.pendingSaves[action.meta.requestId] = {
          postId,
          isSaved: Boolean(currentPost?.isSaved),
        };
        updatePostInCollections(state, postId, (post) => {
          post.isSaved = false;
        });
      })
      .addCase(unsavePost.fulfilled, (state, action) => {
        const postId = action.payload;
        updatePostInCollections(state, postId, (post) => {
          post.isSaved = false;
        });
        state.savedPosts = state.savedPosts.filter((post) => post._id !== postId);
        delete state.pendingSaves[action.meta.requestId];
      })
      .addCase(unsavePost.rejected, (state, action) => {
        const pending = state.pendingSaves[action.meta.requestId];
        updatePostInCollections(state, pending?.postId, (post) => {
          post.isSaved = pending?.isSaved || false;
        });
        delete state.pendingSaves[action.meta.requestId];
      })

      .addCase(commentPost.fulfilled, (state, action) => {
        const { postId, commentsCount } = action.payload;
        updatePostInCollections(state, postId, (post) => {
          post.commentsCount = commentsCount;
        });
      })

      .addCase(deletePost.fulfilled, (state, action) => {
        const postId = action.payload;
        state.posts = state.posts.filter((post) => post._id !== postId);
        state.savedPosts = state.savedPosts.filter((post) => post._id !== postId);
      })

      .addCase(updatePost.fulfilled, (state, action) => {
        const updated = action.payload;
        if (!updated) return;
        updatePostInCollections(state, updated._id, (post) => {
          Object.assign(post, normalizePost({ ...post, ...updated }));
        });
      });
  },
});

export const { resetFeed, setActiveTag, updateCommentCount } = postSlice.actions;
export default postSlice.reducer;
