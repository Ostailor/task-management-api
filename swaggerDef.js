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
        // Task, TaskInput, TaskUpdateInput, TasksResponse, ErrorResponse are likely defined via JSDoc in your model files
        // Add the generic Error schema here if it's not defined elsewhere or if you want a specific structure for it.
        Error: { // Definition for #/components/schemas/Error
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'An error occurred.'
            },
            // Optional: if your Joi validation errors are sometimes bubbled up with more detail
            // errors: {
            //   type: 'array',
            //   items: {
            //     type: 'object',
            //     properties: {
            //       field: { type: 'string', example: 'fieldName' },
            //       message: { type: 'string', example: 'Error message for fieldName' }
            //     }
            //   },
            //   nullable: true
            // }
          },
          required: ['message']
        },
        // Ensure other schemas like UserProfile, Tag, etc., are correctly defined
        // either here or picked up from your JSDoc comments in model files.
        // For example, if UserProfile is defined in taskModelSwagger.js or a userModelSwagger.js:
        // UserProfile: { $ref: '#/components/schemas/UserProfile' } // This line might not be needed if JSDoc handles it
      },
      responses: {
        UnauthorizedError: { // Definition for #/components/responses/UnauthorizedError
          description: 'Unauthorized. Invalid or missing token.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Unauthorized: No token provided' // Or specific error from authMiddleware
                  }
                }
              }
            }
          }
        },
        InternalServerError: { // Definition for #/components/responses/InternalServerError
          description: 'An unexpected error occurred on the server.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'An unexpected internal server error occurred.'
                  }
                }
              }
            }
          }
        },
        NotFoundError: { // Good to have for general 404s
          description: 'The requested resource was not found.',
          content: {
            'application/json': {
              // You can use the generic Error schema or a more specific one
              schema: {
                $ref: '#/components/schemas/Error' // Assumes Error schema is defined above
              }
            }
          }
        }
        // You might also define other common responses like BadRequestError, ForbiddenError here
      }
    },
    // security: [{ // To apply security globally
    //   bearerAuth: []
    // }]
  },
  // Path to the API docs (your route files)
  apis: ['./src/routes/*.js', './src/models/*.js'], // Adjust paths as needed
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;