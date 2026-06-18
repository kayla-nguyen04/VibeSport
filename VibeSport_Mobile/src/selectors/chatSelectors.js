/**
 * Selector helpers for chat messages.
 *
 * Pattern: Select raw data from Redux, merge in useMemo to avoid reference instability.
 * This ensures stable references and prevents unnecessary rerenders.
 */

/**
 * Raw selector for accepted messages (messagesByConversation).
 * Merge with pendingMessages using useMemo in component.
 */
export const selectAcceptedMessages = (state, conversationId) => {
  return state.chat.messagesByConversation[conversationId];
};
