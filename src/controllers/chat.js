const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { formatConversation, formatMessage } = require('../utils/chatUtils');

/**
 * @desc    Get all conversations for the current user
 * @route   GET /api/chat/conversations
 * @access  Private
 */
exports.getConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({
    participants: { $in: [req.user.id] },
  })
    .populate({
      path: 'participants',
      select: 'name email',
    })
    .populate({
      path: 'lastMessage',
      select: 'content readBy createdAt sender',
      populate: {
        path: 'sender',
        select: 'name email',
      },
    })
    .sort({ updatedAt: -1 });

  // Format conversations for response
  const formattedConversations = conversations.map((conversation) =>
    formatConversation(conversation, req.user.id)
  );

  res.status(200).json({
    success: true,
    count: conversations.length,
    data: formattedConversations,
  });
});

/**
 * @desc    Get a single conversation by ID
 * @route   GET /api/chat/conversations/:id
 * @access  Private
 */
exports.getConversation = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id).populate({
    path: 'participants',
    select: 'name email',
  });

  if (!conversation) {
    return next(new ErrorResponse(`對話不存在`, 404));
  }

  // Check if the user is a participant in the conversation
  const isParticipant = conversation.participants.some(
    (participant) => participant._id.toString() === req.user.id
  );

  if (!isParticipant) {
    return next(new ErrorResponse(`不允許訪問此對話`, 403));
  }

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

/**
 * @desc    Start or get a conversation with another user
 * @route   POST /api/chat/conversations
 * @access  Private
 */
exports.createConversation = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    return next(new ErrorResponse(`請提供用戶ID`, 400));
  }

  if (userId === req.user.id) {
    return next(new ErrorResponse(`無法與自己建立對話`, 400));
  }

  // Check if user exists
  const receiver = await User.findById(userId);
  if (!receiver) {
    return next(new ErrorResponse(`用戶不存在`, 404));
  }

  // Check if conversation already exists
  // We need to find a conversation where both users are participants
  let conversation = await Conversation.findOne({
    participants: { $all: [req.user.id, userId] },
  }).populate({
    path: 'participants',
    select: 'name email',
  });

  // If the conversation exists, return it
  if (conversation) {
    return res.status(200).json({
      success: true,
      data: conversation,
    });
  }

  // Create new conversation
  conversation = await Conversation.create({
    participants: [req.user.id, userId],
  });

  // Populate participants information
  conversation = await Conversation.findById(conversation._id).populate({
    path: 'participants',
    select: 'name email',
  });

  res.status(201).json({
    success: true,
    data: conversation,
  });
});

/**
 * @desc    Get messages for a conversation
 * @route   GET /api/chat/conversations/:id/messages
 * @access  Private
 */
exports.getMessages = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(new ErrorResponse(`對話不存在`, 404));
  }

  // Check if the user is a participant
  const isParticipant = conversation.participants.some(
    (participant) => participant.toString() === req.user.id
  );

  if (!isParticipant) {
    return next(new ErrorResponse(`不允許訪問此對話`, 403));
  }

  // Get messages
  const messages = await Message.find({ conversation: req.params.id })
    .populate({
      path: 'sender',
      select: 'name email',
    })
    .sort({ createdAt: 1 });

  // Mark messages as read (those not sent by the current user)
  await Message.updateMany(
    {
      conversation: req.params.id,
      sender: { $ne: req.user.id },
      readBy: { $ne: req.user.id },
    },
    {
      $addToSet: { readBy: req.user.id },
    }
  );

  // Format messages for response
  const formattedMessages = messages.map((message) => formatMessage(message, req.user.id));

  res.status(200).json({
    success: true,
    count: messages.length,
    data: formattedMessages,
  });
});

/**
 * @desc    Send a message in a conversation
 * @route   POST /api/chat/conversations/:id/messages
 * @access  Private
 */
exports.sendMessage = asyncHandler(async (req, res, next) => {
  const { content } = req.body;

  if (!content) {
    return next(new ErrorResponse(`請提供訊息內容`, 400));
  }

  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(new ErrorResponse(`對話不存在`, 404));
  }

  // Check if the user is a participant
  const isParticipant = conversation.participants.some(
    (participant) => participant.toString() === req.user.id
  );

  if (!isParticipant) {
    return next(new ErrorResponse(`不允許在此對話中發送訊息`, 403));
  }

  // Create message
  const message = await Message.create({
    sender: req.user.id,
    content,
    conversation: req.params.id,
    readBy: [req.user.id], // Mark as read by the sender
  });

  // Update conversation's lastMessage reference
  await Conversation.findByIdAndUpdate(req.params.id, {
    lastMessage: message._id,
  });

  // Populate sender information
  const populatedMessage = await Message.findById(message._id).populate({
    path: 'sender',
    select: 'name email',
  });

  // Format message for response
  const formattedMessage = formatMessage(populatedMessage, req.user.id);

  res.status(201).json({
    success: true,
    data: formattedMessage,
  });
});

/**
 * @desc    Mark messages as read
 * @route   PUT /api/chat/conversations/:id/read
 * @access  Private
 */
exports.markAsRead = asyncHandler(async (req, res, next) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return next(new ErrorResponse(`對話不存在`, 404));
  }

  // Check if the user is a participant
  const isParticipant = conversation.participants.some(
    (participant) => participant.toString() === req.user.id
  );

  if (!isParticipant) {
    return next(new ErrorResponse(`不允許訪問此對話`, 403));
  }

  // Mark all messages in the conversation as read by the current user
  const result = await Message.updateMany(
    {
      conversation: req.params.id,
      sender: { $ne: req.user.id }, // Only mark messages not sent by the current user
      readBy: { $ne: req.user.id }, // Only mark messages not already read by the current user
    },
    {
      $addToSet: { readBy: req.user.id },
    }
  );

  res.status(200).json({
    success: true,
    count: result.modifiedCount,
    message: '訊息已標記為已讀',
  });
});
