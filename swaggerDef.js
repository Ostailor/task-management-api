const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Management API',
      version: '1.0.0',
      description: 'A simple API to manage tasks, built with Node.js, Express, and SQLite. Most task endpoints require authentication.',
      contact: {
        name: 'API Support',
        // url: 'http://www.example.com/support', // Optional
        // email: 'support@example.com', // Optional
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api', // Adjust if your base path is different
        description: 'Development server',
      },
    ],
    components: { // Define security scheme
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      },
      schemas: { // Keep your existing schemas here or ensure they are picked up from models
        // Task, TaskInput, TaskUpdateInput, TasksResponse, ErrorResponse
        // ... (and add User, UserLogin, UserRegister schemas if desired for auth routes)
      }
    },
    // security: [{ // To apply security globally
    //   bearerAuth: []
    // }]
  },
  // Path to the API docs (your route files)
  apis: ['./src/routes/*.js', './src/models/*.js'], // Adjust paths as needed, models for schema definitions
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;