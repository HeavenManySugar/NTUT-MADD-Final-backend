const swaggerJsDoc = require('swagger-jsdoc');
const config = require('./index');

// Swagger 定義
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NTUT-MADD API',
      version: '1.0.0',
      description: 'NTUT-MADD 後端 API 文檔',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api`,
        description: '開發環境 API 伺服器',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // 路徑到 API 文檔
  apis: ['./src/routes/*.js', './src/models/*.js', './src/controllers/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerDocs;
