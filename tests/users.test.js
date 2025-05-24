require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const { initializeDatabase, closeDb } = require('../src/database');
const taskService = require('../src/services/taskService');

describe('User Profile API', () => {
  let userTestToken = null;
  let userTestId = null;
  const userTestUsername = `profileuser_${Date.now()}`;
  const userTestPassword = 'password123';
  const userTestInitialEmail = `${userTestUsername}@initial.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await taskService.__clearUsersTableForTesting(); 

    const registerPayload = { username: userTestUsername, password: userTestPassword, email: userTestInitialEmail };
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(registerPayload);

    if (registerRes.status !== 201) {
      console.error("Failed to register user for User Profile tests", registerRes.body); // Kept critical error log
      throw new Error("Setup failed for User Profile tests: could not register user.");
    }

    const loginPayload = { username: userTestUsername, password: userTestPassword };
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(loginPayload);
    
    if (loginRes.status !== 200 || !loginRes.body.token) { 
      console.error("Failed to login user for User Profile tests", loginRes.body); // Kept critical error log
      throw new Error("Setup failed for User Profile tests: could not login user.");
    }
    userTestToken = loginRes.body.token;
    userTestId = loginRes.body.user.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('GET /api/users/me', () => {
    it('should get the current authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userTestToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', userTestId);
      expect(res.body).toHaveProperty('username', userTestUsername);
      expect(res.body).toHaveProperty('email', userTestInitialEmail);
      expect(res.body).not.toHaveProperty('password');
    });

    it('should fail to get profile without a token', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.statusCode).toEqual(401);
    });

    it('should fail to get profile with an invalid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer aninvalidtoken');
      expect(res.statusCode).toEqual(403); 
    });
  });

  describe('PUT /api/users/me', () => {
    const updatedEmail = `${userTestUsername}@updated.com`;

    it('should update the current authenticated user email', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({ email: updatedEmail });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', userTestId);
      expect(res.body).toHaveProperty('username', userTestUsername);
      expect(res.body).toHaveProperty('email', updatedEmail);

      const getRes = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userTestToken}`);
      expect(getRes.body.email).toEqual(updatedEmail);
    });

    it('should allow updating email to null', async () => {
        const res = await request(app)
          .put('/api/users/me')
          .set('Authorization', `Bearer ${userTestToken}`)
          .send({ email: null });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.email).toBeNull();

        await request(app)
          .put('/api/users/me')
          .set('Authorization', `Bearer ${userTestToken}`)
          .send({ email: updatedEmail });
    });

    it('should fail to update email if new email is already in use by another user', async () => {
      const otherUserEmail = `other_profile_${Date.now()}@example.com`;
      await request(app)
        .post('/api/auth/register')
        .send({ username: `otheruser_profile_${Date.now()}`, password: 'password123', email: otherUserEmail });

      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({ email: otherUserEmail });
      
      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Email already in use by another account.');
    });

    it('should return 400 if email format is invalid', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({ email: 'invalid-email' });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Validation error');
    });

    it('should return 400 if no data is sent', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({});
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message'); 
    });

    it('should fail to update profile without a token', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .send({ email: 'any@email.com' });
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('POST /api/users/me/change-password', () => {
    let currentPasswordForChangeTest = userTestPassword;
    const newPasswordForChangeTest = 'newStrongPassword456';

    it('should change the current authenticated user password successfully', async () => {
      const res = await request(app)
        .post('/api/users/me/change-password')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({ oldPassword: currentPasswordForChangeTest, newPassword: newPasswordForChangeTest });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Password changed successfully.');

      const loginWithNewPwRes = await request(app)
        .post('/api/auth/login')
        .send({ username: userTestUsername, password: newPasswordForChangeTest });
      expect(loginWithNewPwRes.statusCode).toEqual(200);
      expect(loginWithNewPwRes.body).toHaveProperty('token');

      currentPasswordForChangeTest = newPasswordForChangeTest; 
    });

    it('should fail if old password is incorrect', async () => {
      const res = await request(app)
        .post('/api/users/me/change-password')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({ oldPassword: 'wrongOldPassword', newPassword: 'anotherNewPassword123' });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'Incorrect current password.');
    });

    it('should fail if new password is too short (less than 6 characters)', async () => {
      const res = await request(app)
        .post('/api/users/me/change-password')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({ oldPassword: currentPasswordForChangeTest, newPassword: 'short' });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringContaining('must be at least 6 characters long')]));
    });
    
    it('should fail if new password is the same as the old password', async () => {
      const res = await request(app)
        .post('/api/users/me/change-password')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({ oldPassword: currentPasswordForChangeTest, newPassword: currentPasswordForChangeTest });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringContaining('New password must be different from the old password.')]));
    });

    it('should fail if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/users/me/change-password')
        .set('Authorization', `Bearer ${userTestToken}`)
        .send({ oldPassword: currentPasswordForChangeTest });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringContaining('"newPassword" is required')]));
    });

    it('should fail to change password without a token', async () => {
      const res = await request(app)
        .post('/api/users/me/change-password')
        .send({ oldPassword: 'any', newPassword: 'anynew' });
      expect(res.statusCode).toEqual(401);
    });
  });
});