const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const taskRoutes = require('./tasks');
const profileRoutes = require('./profile');
const uploadRoutes = require('./upload');
const chatRoutes = require('./chat');

// Mount routers
router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);
router.use('/profile', profileRoutes);
router.use('/upload', uploadRoutes);
router.use('/chat', chatRoutes);

// API health check route
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});

module.exports = router;
