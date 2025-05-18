const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Store online users
const onlineUsers = new Map();

/**
 * Initialize socket.io server
 * @param {Object} io - socket.io server instance
 */
const initializeSocket = (io) => {
  // Authenticate socket connection using JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }

      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.user = decoded;

      // Check if user exists
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      next();
    } catch (error) {
      next(new Error('Authentication error: ' + error.message));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.id}`); // Add user to online users
    onlineUsers.set(socket.user.id, socket.id);

    // Join user to their conversations
    joinUserRooms(socket);

    // Send online status to all users
    io.emit('user:status', {
      userId: socket.user.id,
      status: 'online',
    });

    // 廣播更新的在線用戶列表給所有用戶
    const onlineUsersList = Array.from(onlineUsers.keys());
    io.emit('user:onlineList', onlineUsersList);

    // Handle request for online users list
    socket.on('user:getOnline', () => {
      // Convert Map keys to array and send to client
      const onlineUserIds = Array.from(onlineUsers.keys());
      socket.emit('user:onlineList', onlineUserIds);
    }); // Listen for new messages
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content } = data;

        if (!conversationId || !content) {
          socket.emit('error', { message: '缺少必要參數' });
          return;
        }

        // Check if conversation exists
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: '對話不存在' });
          return;
        }

        // Check if user is a participant
        const isParticipant = conversation.participants.some(
          (participant) => participant.toString() === socket.user.id
        );

        if (!isParticipant) {
          socket.emit('error', { message: '您不是此對話的參與者' });
          return;
        }

        try {
          // Create new message
          const message = await Message.create({
            sender: socket.user.id,
            content,
            conversation: conversationId,
            readBy: [socket.user.id], // Mark as read by sender
          });

          // Update conversation with lastMessage
          await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
          }); // Populate message data
          const populatedMessage = await Message.findById(message._id).populate({
            path: 'sender',
            select: 'name email',
          });

          if (!populatedMessage) {
            socket.emit('error', { message: '訊息創建失敗' });
            return;
          }

          // 確保發送者資訊完整
          const formattedMessage = {
            ...populatedMessage.toObject(),
            isMine: false, // 對其他人來說不是自己發的
          };

          // 對發送者的處理
          if (socket.user && socket.user.id === populatedMessage.sender._id.toString()) {
            formattedMessage.isMine = true; // 對發送者來說是自己發的
          }

          // Emit message to all participants in the conversation
          io.to(`conversation:${conversationId}`).emit('message:new', formattedMessage);

          // Update conversations list for all participants with the new last message
          for (const participantId of conversation.participants) {
            try {
              const userSocketId = onlineUsers.get(participantId.toString());
              if (userSocketId) {
                const updatedConversation = await Conversation.findById(conversationId)
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
                  });

                if (updatedConversation) {
                  // 格式化對話以包含當前參與者的資訊
                  const formattedConversation = {
                    ...updatedConversation.toObject(),
                    otherUser: null,
                  };

                  // 找出對方用戶
                  const otherUser = updatedConversation.participants.find(
                    (p) => p._id.toString() !== participantId.toString()
                  );

                  if (otherUser) {
                    formattedConversation.otherUser = otherUser;
                  }

                  io.to(userSocketId).emit('conversation:update', formattedConversation);
                }
              }
            } catch (err) {
              console.error(`更新對話時發生錯誤 (用戶 ${participantId}):`, err);
            }
          }
        } catch (err) {
          console.error('創建或更新訊息時發生錯誤:', err);
          socket.emit('error', { message: '發送訊息失敗' });
        }
      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('error', { message: '發送訊息時發生錯誤' });
      }
    });

    // Listen for read receipts
    socket.on('message:read', async (data) => {
      try {
        const { conversationId } = data;

        if (!conversationId) {
          socket.emit('error', { message: '缺少對話ID' });
          return;
        }

        // Check if conversation exists
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: '對話不存在' });
          return;
        }

        // Check if user is a participant
        const isParticipant = conversation.participants.some(
          (participant) => participant.toString() === socket.user.id
        );

        if (!isParticipant) {
          socket.emit('error', { message: '您不是此對話的參與者' });
          return;
        }

        // Update messages as read
        const result = await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.user.id },
            readBy: { $ne: socket.user.id },
          },
          {
            $addToSet: { readBy: socket.user.id },
          }
        );

        if (result.modifiedCount > 0) {
          // Get the updated messages that were marked as read
          const updatedMessages = await Message.find({
            conversation: conversationId,
            readBy: socket.user.id,
          }).select('_id');

          // Emit read status to all users in the conversation
          io.to(`conversation:${conversationId}`).emit('message:read', {
            conversationId,
            userId: socket.user.id,
            messageIds: updatedMessages.map((msg) => msg._id),
          });
        }
      } catch (error) {
        console.error('Mark as read error:', error);
        socket.emit('error', { message: '標記為已讀時發生錯誤' });
      }
    });

    // User typing indicator
    socket.on('user:typing', (data) => {
      const { conversationId, isTyping } = data;

      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('user:typing', {
          userId: socket.user.id,
          conversationId,
          isTyping,
        });
      }
    }); // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);

      // Remove user from online users
      onlineUsers.delete(socket.user.id);

      // Send offline status to all users
      io.emit('user:status', {
        userId: socket.user.id,
        status: 'offline',
      });

      // 廣播更新的在線用戶列表給所有用戶
      const onlineUsersList = Array.from(onlineUsers.keys());
      io.emit('user:onlineList', onlineUsersList);
    });
  });
};

// Join user to all their conversation rooms
const joinUserRooms = async (socket) => {
  try {
    const userId = socket.user.id;

    // Find all conversations the user is a part of
    const conversations = await Conversation.find({
      participants: userId,
    });

    // Join the user to a room for each conversation
    conversations.forEach((conversation) => {
      socket.join(`conversation:${conversation._id}`);
    });
  } catch (error) {
    console.error('Error joining user rooms:', error);
  }
};

module.exports = initializeSocket;
