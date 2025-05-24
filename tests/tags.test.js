const request = require('supertest');
const app = require('../src/app'); // Adjust path as necessary
const { getDb } = require('../src/database');
const { __clearUsersTableForTesting } = require('../src/services/userService');
const { __clearTasksTableForTesting } = require('../src/services/taskService');

// Helper functions for user registration and login (copied or adapted from other test files)
async function __registerUser(username, email, password) {
  return request(app)
    .post('/api/auth/register')
    .send({ username, email, password });
}

async function __loginUser(username, password) {
  return request(app)
    .post('/api/auth/login')
    .send({ username, password });
}

describe('Tag API Endpoints', () => {
  let testUserToken;
  let testUserId;

  beforeAll(async () => {
    // Clear tables before all tests in this suite
    console.log('tags.test.js: Clearing users table before test suite.');
    await __clearUsersTableForTesting();
    console.log('tags.test.js: Clearing tasks and tags table before test suite.');
    await __clearTasksTableForTesting(); // This also clears tags and task_tags

    // Register and login a test user
    const uniqueUserSuffix = Date.now();
    const username = `tagtestuser_${uniqueUserSuffix}`;
    const email = `tagtestuser_${uniqueUserSuffix}@example.com`;
    const password = 'password123';

    console.log(`tags.test.js: Attempting to register user: { username: "${username}", email: "${email}" }`);
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ username, email, password });

    console.log(`tags.test.js: Registration response status: ${registerRes.status}, body: ${JSON.stringify(registerRes.body)}`);
    if (registerRes.status !== 201 || !registerRes.body.user || !registerRes.body.user.id) {
      console.error('Failed to register user for tag tests. Response:', registerRes.body);
      throw new Error('Test user registration failed in beforeAll hook for tags.test.js');
    }
    testUserId = registerRes.body.user.id;
    console.log(`tags.test.js: User registered successfully, ID: ${testUserId}`);

    console.log(`tags.test.js: Attempting to login user: { username: "${username}" }`);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password });

    console.log(`tags.test.js: Login response status: ${loginRes.status}, body: ${JSON.stringify(loginRes.body)}`);
    if (loginRes.status !== 200 || !loginRes.body.token) {
      console.error('Failed to login user for tag tests. Response:', loginRes.body);
      throw new Error('Test user login failed in beforeAll hook for tags.test.js');
    }
    testUserToken = loginRes.body.token;
    console.log(`tags.test.js: User logged in successfully. Token obtained. User ID: ${testUserId}`);
  });

  beforeEach(async () => {
    // Clear tasks and tags before each test to ensure isolation for tag creation tests
    await __clearTasksTableForTesting(); // This clears tasks, tags, and task_tags
  });

  describe('GET /api/tags', () => {
    beforeEach(async () => {
      // This beforeEach creates tags for other tests in this describe block
      if (!testUserToken) return;
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Task For Tag List 1', tags: ['Work', 'Home', 'ProjectX'] });
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Task For Tag List 2', tags: ['Urgent', 'Shopping', 'Home'] });
    });

    it('should require authentication to get tags', async () => {
      const res = await request(app).get('/api/tags');
      expect(res.statusCode).toEqual(401);
    });

    it('should return an empty array if no tags exist', async () => {
      if (!testUserToken) return;
      await __clearTasksTableForTesting(); // <--- Add this line

      const res = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([]);
    });

    it('should return a list of unique tags created via tasks', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${testUserToken}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toBeInstanceOf(Array);
      // EXPECTATION CHANGE:
      const expectedTagNames = ['home', 'projectx', 'shopping', 'urgent', 'work'].sort();
      const tagNames = res.body.map(tag => tag.name).sort();
      expect(tagNames).toEqual(expectedTagNames);

      res.body.forEach(tag => {
        expect(tag).toHaveProperty('id');
        expect(tag.name).toBe(tag.name.toLowerCase()); // Verify canonical form
      });
      expect(res.body.length).toBe(expectedTagNames.length);
    });

    it('should return tags sorted by name (case-insensitively)', async () => {
        if (!testUserToken) return;
        await __clearTasksTableForTesting(); 

        // FIX: Use titles with at least 3 characters
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Task Zebra', tags: ['Zebra'] });
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Task Apple', tags: ['apple'] });
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Task Banana', tags: ['Banana'] });

        const res = await request(app)
          .get('/api/tags')
          .set('Authorization', `Bearer ${testUserToken}`);
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.map(t => t.name)).toEqual(['apple', 'banana', 'zebra']); 
    });
  });

  describe('PUT /api/tags/:id', () => {
    let tagToUpdate; // Will hold { id: number, name: string (canonical) }

    beforeEach(async () => {
      if (!testUserToken) return;
      await __clearTasksTableForTesting(); 

      // Tags will be 'initialtag' and 'anotherone' (canonical lowercase)
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Task for Tag Update', tags: ['initialTag', 'anotherOne'] }); 
      
      const tagsRes = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${testUserToken}`);
      // EXPECTATION CHANGE: Find by canonical lowercase name
      tagToUpdate = tagsRes.body.find(t => t.name === 'initialtag'); 
      
      if (!tagToUpdate) {
          // This task creation will also result in 'initialtag'
          await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${testUserToken}`)
            .send({ title: 'Ensuring Tag Exists', tags: ['initialTag'] });
          const updatedTagsRes = await request(app)
            .get('/api/tags')
            .set('Authorization', `Bearer ${testUserToken}`);
          // EXPECTATION CHANGE: Find by canonical lowercase name
          tagToUpdate = updatedTagsRes.body.find(t => t.name === 'initialtag');
          if (!tagToUpdate) {
            // This console.error should ideally not be hit if setup is correct
            console.error("Failed to create 'initialtag' for PUT tests in beforeEach.");
          }
      }
    });

    it('should require authentication to update a tag', async () => {
      const res = await request(app)
        .put('/api/tags/1')
        .send({ name: 'New Name' });
      expect(res.statusCode).toEqual(401);
    });

    it('should successfully update an existing tag name', async () => {
      if (!testUserToken || !tagToUpdate) return;

      // EXPECTATION CHANGE: New name will be canonicalized by the service
      const newNameAttempt = 'updatedTagName';
      const expectedCanonicalName = 'updatedtagname'; 
      const res = await request(app)
        .put(`/api/tags/${tagToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ name: newNameAttempt });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', tagToUpdate.id);
      // EXPECTATION CHANGE: Service returns canonical name
      expect(res.body).toHaveProperty('name', expectedCanonicalName);

      const tagsRes = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${testUserToken}`);
      const updatedTagInList = tagsRes.body.find(t => t.id === tagToUpdate.id);
      // EXPECTATION CHANGE: Stored name is canonical
      expect(updatedTagInList.name).toBe(expectedCanonicalName);
      // EXPECTATION CHANGE: Old canonical name should not exist if it was different
      const oldTagInList = tagsRes.body.find(t => t.name === 'initialtag'); 
      // If newName is different from 'initialtag', oldTagInList should be undefined.
      // If newName is 'initialtag', then oldTagInList will be the same as updatedTagInList.
      // For this test, since we are updating 'initialtag' to 'updatedtagname', the original 'initialtag' (as a name)
      // should not be associated with this ID anymore.
      // However, if another task still uses 'initialtag', that tag object (with a different ID or same if no other tags were 'initialtag') would still exist.
      // The check here is that *this specific tag ID* no longer has the name 'initialtag'.
      // A simpler check is that the updatedTagInList.name is the new canonical name.
      // And that no tag with the old name 'initialtag' has the ID tagToUpdate.id (unless new name is also 'initialtag')
      if (expectedCanonicalName !== 'initialtag') {
        const oldNamedTagWithSameId = tagsRes.body.find(t => t.id === tagToUpdate.id && t.name === 'initialtag');
        expect(oldNamedTagWithSameId).toBeUndefined();
      }
    });

    it('should return 404 if trying to update a non-existent tag ID', async () => {
      if (!testUserToken) return;
      const nonExistentId = 99999;
      const res = await request(app)
        .put(`/api/tags/${nonExistentId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ name: 'New Name' });
      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 for invalid tag ID format (e.g., not a number)', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .put('/api/tags/abc')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ name: 'New Name' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe('Validation error'); // General message
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors[0].field).toBe('id');
      expect(res.body.errors[0].message).toContain('id must be a number');
    });

    it('should return 400 if new tag name is missing', async () => {
      if (!testUserToken || !tagToUpdate) return;
      const res = await request(app)
        .put(`/api/tags/${tagToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({}); // Missing name
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe('Validation error');
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors[0].field).toBe('name');
      expect(res.body.errors[0].message).toContain('name is required');
    });
    
    it('should return 400 if new tag name is empty', async () => {
      if (!testUserToken || !tagToUpdate) return;
      const res = await request(app)
        .put(`/api/tags/${tagToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ name: '  ' }); // Empty name after trim
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe('Validation error');
      expect(res.body.errors).toBeInstanceOf(Array);
      expect(res.body.errors[0].field).toBe('name');
      expect(res.body.errors[0].message).toContain('name is not allowed to be empty');
    });

    it('should return 400 if new tag name exceeds max length', async () => {
        if (!testUserToken || !tagToUpdate) return;
        const longName = 'a'.repeat(51);
        const res = await request(app)
          .put(`/api/tags/${tagToUpdate.id}`)
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({ name: longName });
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toBe('Validation error');
        expect(res.body.errors).toBeInstanceOf(Array);
        expect(res.body.errors[0].field).toBe('name');
        expect(res.body.errors[0].message).toContain('name length must be less than or equal to 50 characters long');
      });

    it('should return 409 if trying to update tag name to a name that already exists on another tag', async () => {
      if (!testUserToken || !tagToUpdate) return;

      // 'anotherone' (canonical) already exists from the beforeEach setup.
      // We are trying to update 'initialtag' (tagToUpdate.name) to 'anotherOne' (which becomes 'anotherone').
      const res = await request(app)
        .put(`/api/tags/${tagToUpdate.id}`) 
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ name: 'anotherOne' }); // Service will canonicalize to 'anotherone' for conflict check
      
      expect(res.statusCode).toEqual(409);
      // The conflict message from the service uses the *original attempted name* (after trim) for user clarity.
      expect(res.body.message).toContain('A tag with the name "anotherOne" already exists.');
    });
    
    // This test replaces/refines the old "update to different case" test
    it('should update a tag name, result name should be canonical (lowercase)', async () => {
        if (!testUserToken || !tagToUpdate) return; // tagToUpdate.name is 'initialtag'
  
        const newNameMixedCase = 'UpdatedTagName'; 
        const expectedCanonicalName = 'updatedtagname'; // Service will store and return this
        const res = await request(app)
          .put(`/api/tags/${tagToUpdate.id}`)
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({ name: newNameMixedCase }); 
  
        expect(res.statusCode).toEqual(200);
        // EXPECTATION CHANGE: Service returns the canonical (lowercase) name
        expect(res.body.name).toBe(expectedCanonicalName); 
  
        const tagsRes = await request(app)
          .get('/api/tags')
          .set('Authorization', `Bearer ${testUserToken}`);
        const updatedTagInList = tagsRes.body.find(t => t.id === tagToUpdate.id);
        // EXPECTATION CHANGE: Stored name is canonical
        expect(updatedTagInList.name).toBe(expectedCanonicalName);
      });

    it('should allow updating a tag name to the exact same canonical name (no effective change)', async () => {
        if (!testUserToken || !tagToUpdate) return; // tagToUpdate.name is 'initialtag'
  
        // EXPECTATION CHANGE: Use the canonical name for the "same name" test
        const sameName = 'initialtag'; 
        const res = await request(app)
          .put(`/api/tags/${tagToUpdate.id}`)
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({ name: sameName }); // Input is already canonical
  
        expect(res.statusCode).toEqual(200);
        // EXPECTATION CHANGE: Name remains the same canonical form
        expect(res.body.name).toBe(sameName);
      });
  });

  describe('GET /api/tags/autocomplete', () => {
    let otherTestUserToken;
    let otherTestUserId;

    beforeAll(async () => {
      // Create a second user for testing user-specificity
      const otherUserCredentials = {
        username: `autocomp_otheruser_${Date.now()}`,
        password: 'password123',
        email: `autocomp_other_${Date.now()}@example.com`,
      };
      const regRes = await __registerUser(otherUserCredentials.username, otherUserCredentials.email, otherUserCredentials.password);
      otherTestUserId = regRes.body.user.id;
      const loginRes = await __loginUser(otherUserCredentials.username, otherUserCredentials.password);
      otherTestUserToken = loginRes.body.token;
    });

    beforeEach(async () => {
      // Clear tasks and tags before each autocomplete test to ensure clean state
      await __clearTasksTableForTesting();

      // Create tags for the main testUser
      if (testUserToken) {
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Autocomplete Task 1', description: 'Desc 1', tags: ['apple', 'apricot', 'banana'] });
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Autocomplete Task 2', description: 'Desc 2', tags: ['ApplePie', 'blueberry', 'banana'] }); // Mixed case for 'ApplePie'
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Autocomplete Task 3', description: 'Desc 3', tags: ['cherry', 'apricot'] });
      }

      // Create tags for the otherTestUser
      if (otherTestUserToken) {
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${otherTestUserToken}`).send({ title: 'Other User Task', description: 'Other Desc', tags: ['apple', 'avocado'] });
      }
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/tags/autocomplete?q=a');
      expect(res.statusCode).toEqual(401);
    });

    it('should return an empty array if query "q" is missing or too short (e.g. < 1 char)', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tags/autocomplete')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([]);

      const res2 = await request(app)
        .get('/api/tags/autocomplete?q=')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res2.statusCode).toEqual(200);
      expect(res2.body).toEqual([]);
    });

    it('should return matching tags for the authenticated user, sorted by name', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tags/autocomplete?q=ap')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([
        { id: expect.any(Number), name: 'apple' },
        { id: expect.any(Number), name: 'applepie' }, // Stored as lowercase
        { id: expect.any(Number), name: 'apricot' }
      ]);
    });

    it('should be case-insensitive for the query "q"', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tags/autocomplete?q=AP') // Uppercase query
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([
        { id: expect.any(Number), name: 'apple' },
        { id: expect.any(Number), name: 'applepie' },
        { id: expect.any(Number), name: 'apricot' }
      ]);
    });
    
    it('should return an empty array if no tags match the prefix for the user', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tags/autocomplete?q=xyz')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tags/autocomplete?q=ap&limit=2')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(2);
      // Results should be 'apple', 'applepie' because of sorting
      expect(res.body.map(t => t.name)).toEqual(['apple', 'applepie']);
    });

    it('should only return tags used by the authenticated user (not other users tags)', async () => {
      if (!testUserToken) return;
      // 'avocado' was created by otherTestUser, main testUser does not have it.
      const res = await request(app)
        .get('/api/tags/autocomplete?q=av')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.map(t => t.name)).not.toContain('avocado');
      expect(res.body).toEqual([]); // 'avocado' is not for testUser
    });

     it('should return all unique tags for the user if query "q" is empty and "showAll=true" is passed (optional extension)', async () => {
        if (!testUserToken) return;
        
        const res = await request(app)
          .get('/api/tags/autocomplete?showAll=true') // No 'q'
          .set('Authorization', `Bearer ${testUserToken}`);
        
        expect(res.statusCode).toEqual(200);
        
        // Now expect all user tags, sorted by name (as per getAllTagsForUser from the beforeEach setup)
        const expectedTagNames = ['apple', 'applepie', 'apricot', 'banana', 'blueberry', 'cherry'].sort();
        const receivedTagNames = res.body.map(t => t.name).sort();
        expect(receivedTagNames).toEqual(expectedTagNames);
        expect(res.body.length).toEqual(expectedTagNames.length);
        res.body.forEach(tag => {
            expect(tag).toHaveProperty('id');
            expect(tag).toHaveProperty('name');
        });
      });
  });
});