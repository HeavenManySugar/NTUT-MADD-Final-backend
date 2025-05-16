const morgan = require('morgan');
const config = require('../config');

// Create a custom morgan token
morgan.token('body', (req) => {
  const body = {...req.body};

  // Don't log passwords
  if (body.password) {
    body.password = '[PROTECTED]';
  }

  return JSON.stringify(body);
});

// Set up logging middleware
const setupLogger = (app) => {
  if (config.env === 'development') {
    app.use(morgan(':method :url :status :response-time ms - :body'));
  } else {
    app.use(morgan('combined'));  // Use standard combined format in production
  }
};

module.exports = setupLogger;
