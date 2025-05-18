const express = require('express');
const { protect } = require('../middlewares/auth');
const {
  getConversations,
  getConversation,
  createConversation,
  getMessages,
  sendMessage,
  markAsRead,
} = require('../controllers/chat');

const router = express.Router();

// Protect all routes
router.use(protect);

// Conversation routes
router.route('/conversations').get(getConversations).post(createConversation);

router.route('/conversations/:id').get(getConversation);

// Message routes
router.route('/conversations/:id/messages').get(getMessages).post(sendMessage);

// Mark messages as read
router.route('/conversations/:id/read').put(markAsRead);

module.exports = router;
