const express = require('express');
const taskRoutes = require('./routes/taskRoutes');
const authRoutes = require('./routes/authRoutes'); // Import auth routes
const userRoutes = require('./routes/userRoutes'); // Import user routes
const tagRoutes = require('./routes/tagRoutes'); // Import tag routes
const specs = require('../swaggerDef'); // Import the swagger specification directly
const swaggerUi = require('swagger-ui-express'); // Import swagger-ui-express
const errorHandler = require('./middleware/errorHandler'); // Import the error handler
const fs = require('fs'); // Import the file system module

const app = express();

app.use(express.json()); // Middleware to parse JSON bodies

// Log all requests in development or test mode
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  // Add logging logic here
}

// Swagger UI setup
// Check if specs is correctly defined before using it
if (specs) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  // Generate swagger-output.json only if not in test to avoid cluttering test output
  if (process.env.NODE_ENV !== 'test') {
    const swaggerOutput = './swagger-output.json';
    fs.writeFileSync(swaggerOutput, JSON.stringify(specs, null, 2));
    console.log(`Swagger specification has been written to ${swaggerOutput}`);
  }
} else {
  console.error("Swagger specification (specs) is undefined. API docs will not be available.");
}

// API routes
app.use('/api/auth', authRoutes); // Add auth routes
app.use('/api/users', userRoutes); // Add user routes
app.use('/api/tasks', taskRoutes); // Task routes will be protected
app.use('/api/tags', tagRoutes); // Mount tag routes

// Optional: A simple root route
app.get('/', (req, res) => {
  res.send('Task Management API is running. Visit /api-docs for documentation.');
});

// Add the error handling middleware as the last middleware
app.use(errorHandler);

module.exports = app;