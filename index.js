const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middlewares/error');
const config = require('./src/config');
const apiRoutes = require('./src/routes/index');
const setupLogger = require('./src/middlewares/logger');
const swaggerDocs = require('./src/config/swagger');
const initializeSocket = require('./src/services/socketService');

// Initialize express
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Adjust this to match your frontend URL in production
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Connect to database
connectDB();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Apply security middlewares
// 自定義 Helmet 配置，允許 Swagger UI 和 外部CDN 正常運作
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'cdn.socket.io',
          'cdn.jsdelivr.net',
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
      },
    },
  })
);
app.use(cors()); // Enable CORS

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
setupLogger(app);

// Setup Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, { explorer: true }));

// Mount routes
app.use('/api', apiRoutes);

// Add a root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the NTUT-MADD API',
    version: '1.0.0',
    documentation: '/api-docs',
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler middleware
app.use(errorHandler);

// Initialize Socket.IO
initializeSocket(io);

// Start server
const PORT = config.port;

const server = httpServer.listen(PORT, () => {
  console.log(`Server running in ${config.env} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;
