/**
 * Utility functions for chat-related operations
 */

/**
 * Format conversation data for client response
 * @param {Object} conversation - The conversation document
 * @param {String} currentUserId - The ID of the current user
 * @returns {Object} Formatted conversation data
 */
exports.formatConversation = (conversation, currentUserId) => {
  if (!conversation) return null;

  // 安全地檢查 participants 是否為數組
  const participants = Array.isArray(conversation.participants) ? conversation.participants : [];

  // 安全地尋找其他參與者
  let otherParticipant = null;
  if (participants.length > 0) {
    otherParticipant = participants.find((participant) => {
      // 檢查 participant 是否有 _id 屬性
      if (!participant || !participant._id) return false;
      return participant._id.toString() !== currentUserId;
    });
  }
  // 安全地計算未讀訊息數
  let unreadCount = 0;
  if (conversation.lastMessage) {
    // Extract the lastMessage readBy array safely
    const lastMessageReadBy = Array.isArray(conversation.lastMessage.readBy)
      ? conversation.lastMessage.readBy
      : [];

    // Get the sender ID safely, handling both populated and unpopulated cases
    let lastMessageSenderId = '';
    if (conversation.lastMessage.sender) {
      if (typeof conversation.lastMessage.sender === 'object') {
        lastMessageSenderId = conversation.lastMessage.sender._id
          ? conversation.lastMessage.sender._id.toString()
          : '';
      } else {
        lastMessageSenderId = conversation.lastMessage.sender.toString();
      }
    }

    const senderIsCurrentUser = lastMessageSenderId === currentUserId;

    // If the last message sender is not the current user and the current user hasn't read it
    if (
      !senderIsCurrentUser &&
      !lastMessageReadBy.some((id) => id && id.toString && id.toString() === currentUserId)
    ) {
      unreadCount = 1; // At least the last message is unread

      // Note: For a more accurate count, we would need to query the database
      // to count all unread messages in this conversation, but for UI purposes
      // often just knowing there are unread messages (1+) is sufficient
    }
  }

  return {
    _id: conversation._id,
    otherUser: otherParticipant || null,
    participants: participants,
    lastMessage: conversation.lastMessage || null,
    unreadCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

/**
 * Format message data for client response
 * @param {Object} message - The message document
 * @param {String} currentUserId - The ID of the current user
 * @returns {Object} Formatted message data
 */
exports.formatMessage = (message, currentUserId) => {
  if (!message) return null;
  // 安全地檢查 sender 是否有效並提取 ID
  let senderId = '';
  if (message.sender) {
    if (typeof message.sender === 'object') {
      // If sender is populated (object with _id)
      senderId = message.sender._id ? message.sender._id.toString() : '';
    } else {
      // If sender is just the ID as string or ObjectId
      senderId = message.sender.toString();
    }
  }
  const isMine = senderId === currentUserId;
  // 安全地檢查 readBy 是否為數組
  const readBy = Array.isArray(message.readBy) ? message.readBy : [];

  // Check if message is read by other participants (not the sender)
  // If current user is the sender, check if any other user has read it
  // If current user is not the sender, we don't care about this for UI purposes
  const isRead =
    isMine && readBy.some((id) => id && id.toString && id.toString() !== currentUserId);

  return {
    _id: message._id,
    content: message.content,
    sender: message.sender,
    isMine,
    isRead,
    readBy: readBy,
    createdAt: message.createdAt,
  };
};

/**
 * Get recipient IDs from a conversation, excluding the specified user
 * @param {Object} conversation - The conversation document
 * @param {String} excludeUserId - The user ID to exclude
 * @returns {Array} Array of recipient user IDs
 */
exports.getRecipientIds = (conversation, excludeUserId) => {
  if (!conversation || !conversation.participants) return [];

  return conversation.participants
    .filter((participant) => participant.toString() !== excludeUserId)
    .map((participant) => participant.toString());
};
