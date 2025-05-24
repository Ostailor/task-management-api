require('dotenv').config(); // Load environment variables from .env file

const app = require('./app');
const { initializeDatabase } = require('./database');

const PORT = process.env.PORT || 3001; // Use environment variable for PORT, fallback to 3001

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Node environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
}

startServer();