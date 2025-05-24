const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database'); // Ensure getDb is imported
const { JWT_SECRET, JWT_EXPIRES_IN } = process.env; // Ensure these are available

const registerUser = async (userData) => {
  const db = await getDb();
  const { username, password, email } = userData; // Add email

  const existingUser = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (existingUser) {
    const error = new Error('Username already exists');
    error.statusCode = 409; // Conflict
    throw error;
  }

  if (email) {
    const existingEmail = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      const error = new Error('Email already in use');
      error.statusCode = 409; // Conflict
      throw error;
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10); // Hash password
  const createdAt = new Date().toISOString();

  const result = await db.run(
    'INSERT INTO users (username, password, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', // Add email to insert
    [username, hashedPassword, email || null, createdAt, createdAt] // Use email or null
  );

  // --- BEGIN DIAGNOSTIC CHANGE ---
  // Re-fetch the user to ensure it's retrievable before login attempts in tests
  const newlyRegisteredUser = await db.get('SELECT id, username, email, createdAt FROM users WHERE id = ?', [result.lastID]);
  if (!newlyRegisteredUser) {
    console.error(`userService.registerUser: CRITICAL! User with ID ${result.lastID} not found immediately after insert.`);
    // This would be a major issue if it happens
  } else {
    console.log(`userService.registerUser: Successfully re-fetched user ID ${newlyRegisteredUser.id} after insert.`);
  }
  // Return the re-fetched user data (or the original constructed one if you prefer, but for diagnostics this is better)
  return newlyRegisteredUser || { id: result.lastID, username, email: email || null, createdAt };
  // --- END DIAGNOSTIC CHANGE ---
};

const loginUser = async (loginData) => {
  const db = await getDb();
  const { username, password } = loginData;

  console.log(`userService.loginUser: Attempting to fetch user by username: ${username}`); // Log username
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

  if (!user) {
    console.log(`userService.loginUser: User not found in DB for username: ${username}`);
    const error = new Error('Invalid username or password');
    error.statusCode = 401; // Unauthorized
    throw error;
  }

  // --- BEGIN DIAGNOSTIC LOG ---
  console.log(`userService.loginUser: User found in DB for username ${username}. User data:`, {id: user.id, username: user.username, email: user.email, password_hash_length: user.password ? user.password.length : 'N/A'});
  // --- END DIAGNOSTIC LOG ---

  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    console.log(`userService.loginUser: Password mismatch for username: ${username}. Provided password: '${password}', Stored hash: '${user.password}'`);
    const error = new Error('Invalid username or password');
    error.statusCode = 401;
    throw error;
  }

  console.log(`userService.loginUser: Password match for username: ${username}.`);
  // Generate JWT
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    token,
    user: { id: user.id, username: user.username, email: user.email },
  };
};

const getUserById = async (id) => {
    const db = await getDb();
    // Exclude password from the result
    return db.get('SELECT id, username, email, createdAt, updatedAt FROM users WHERE id = ?', [id]); // Add email to select
};

const updateUserProfile = async (userId, updateData) => {
  const db = await getDb();
  const { email } = updateData; // For now, only allowing email update

  if (email === undefined) { // Check if email field is explicitly provided
    const error = new Error('No update data provided or only email is updatable.');
    error.statusCode = 400;
    throw error;
  }

  // Check if the new email is already in use by another user
  if (email !== null) { // Allow setting email to null if desired, or validate if it must exist
    const existingUserWithEmail = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (existingUserWithEmail) {
      const error = new Error('Email already in use by another account.');
      error.statusCode = 409; // Conflict
      throw error;
    }
  }

  const updatedAt = new Date().toISOString();
  const result = await db.run(
    'UPDATE users SET email = ?, updatedAt = ? WHERE id = ?',
    [email, updatedAt, userId]
  );

  if (result.changes === 0) {
    // This should ideally not happen if the userId comes from a valid token
    const error = new Error('User not found or no changes made.');
    error.statusCode = 404;
    throw error;
  }

  return getUserById(userId); // Return the updated user profile
};

const changePassword = async (userId, oldPassword, newPassword) => {
  const db = await getDb();

  const user = await db.get('SELECT id, password FROM users WHERE id = ?', [userId]);
  if (!user) {
    // This should not happen if userId is from a valid token
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const isOldPasswordMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isOldPasswordMatch) {
    const error = new Error('Incorrect current password.');
    error.statusCode = 400; // Bad Request or 401 Unauthorized (debatable, 400 is common for this)
    throw error;
  }

  if (oldPassword === newPassword) {
    const error = new Error('New password cannot be the same as the old password.');
    error.statusCode = 400;
    throw error;
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  const updatedAt = new Date().toISOString();

  const result = await db.run(
    'UPDATE users SET password = ?, updatedAt = ? WHERE id = ?',
    [hashedNewPassword, updatedAt, userId]
  );

  if (result.changes === 0) {
    // Should not happen
    const error = new Error('Password could not be updated.');
    error.statusCode = 500;
    throw error;
  }

  return { message: 'Password changed successfully.' };
};

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  updateUserProfile,
  changePassword, // Add new function
  __clearUsersTableForTesting: async () => { /* ... */ },
};