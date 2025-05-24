require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const { initializeDatabase, closeDb } = require('../src/database');
const taskService = require('../src/services/taskService');

describe('Authentication API', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    await taskService.__clearUsersTableForTesting();
  });

  // --- Auth Endpoint Tests ---
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully without email', async () => {
      const uniqueUsernameForRegister = `reguser_${Date.now()}`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: uniqueUsernameForRegister, password: 'password123' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully');
      expect(res.body.user).toHaveProperty('username', uniqueUsernameForRegister);
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).toHaveProperty('email', null);
    });
    
    it('should register a new user successfully with email', async () => {
      const uniqueUsernameForRegister = `newuser_email_${Date.now()}`;
      const uniqueEmail = `new_${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: uniqueUsernameForRegister, password: 'password123', email: uniqueEmail });
      expect(res.statusCode).toEqual(201);
      expect(res.body.user).toHaveProperty('username', uniqueUsernameForRegister);
      expect(res.body.user).toHaveProperty('email', uniqueEmail);
    });

    it('should fail to register with an existing username', async () => {
      const existingUsername = `existinguser_${Date.now()}`;
      await request(app)
        .post('/api/auth/register')
        .send({ username: existingUsername, password: 'password123' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: existingUsername, password: 'anotherpassword' });
      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Username already exists');
    });
    
    it('should fail to register with an existing email', async () => {
      const firstUserEmail = `existing_email_${Date.now()}@example.com`;
      await request(app)
        .post('/api/auth/register')
        .send({ username: `user1_email_${Date.now()}`, password: 'password123', email: firstUserEmail });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: `user2_email_${Date.now()}`, password: 'anotherpassword', email: firstUserEmail });
      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Email already in use');
    });

    it('should fail to register with missing username', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ password: 'password123' });
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('message', 'Username and password are required');
    });

     it('should fail to register with short password', async () => {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ username: `shortpassuser_${Date.now()}`, password: '123' });
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('message', 'Password must be at least 6 characters long');
    });
  });

  describe('POST /api/auth/login', () => {
    const loginTestUsername = `loginuser_${Date.now()}`;
    const loginTestPassword = 'password123';
    const loginTestEmail = `${loginTestUsername}@example.com`;
    let loginTestUserId = null;


    beforeEach(async () => { 
      await taskService.__clearUsersTableForTesting();
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ username: loginTestUsername, password: loginTestPassword, email: loginTestEmail });
      loginTestUserId = registerRes.body.user.id;
    });

    it('should login an existing user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: loginTestUsername, password: loginTestPassword });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Login successful');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('username', loginTestUsername);
      expect(res.body.user).toHaveProperty('email', loginTestEmail);
      expect(res.body.user).toHaveProperty('id', loginTestUserId);
    });

    it('should fail to login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: loginTestUsername, password: 'wrongpassword' });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Invalid username or password');
    });

    it('should fail to login with non-existent username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: `nonexistentuser_${Date.now()}`, password: 'password123' });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Invalid username or password');
    });
  });
});