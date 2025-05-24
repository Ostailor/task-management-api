require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const { initializeDatabase, getDb, closeDb } = require('../src/database'); // closeDb is already imported
const taskService = require('../src/services/taskService');

let testUserToken = null;
let testUserId = null;
const testUsername = `tasktestuser_${Date.now()}`; // Ensure unique username for each test run
const testPassword = 'password123';
const testEmail = `${testUsername}@example.com`; // Added for consistency

describe('Task API with Authentication', () => {
  beforeAll(async () => {
    await initializeDatabase(); // Ensures DB is ready
    console.log(`tasks.test.js: Clearing users table before test suite.`);
    await taskService.__clearUsersTableForTesting(); 
    console.log(`tasks.test.js: Clearing tasks table before test suite.`);
    await taskService.__clearTasksTableForTesting(); 

    try {
      console.log(`tasks.test.js: Attempting to register user: { username: "${testUsername}", email: "${testEmail}" }`);
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ username: testUsername, password: testPassword, email: testEmail });
      
      console.log(`tasks.test.js: Registration response status: ${registerRes.status}, body:`, registerRes.body);
      if (registerRes.status !== 201) {
        throw new Error(`tasks.test.js: Registration failed. Status: ${registerRes.status}, Body: ${JSON.stringify(registerRes.body)}`);
      }
      
      const registeredUserId = registerRes.body.user.id;
      console.log(`tasks.test.js: User registered successfully, ID: ${registeredUserId}`);

      console.log(`tasks.test.js: Attempting to login user: { username: "${testUsername}" }`);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: testUsername, password: testPassword });

      console.log(`tasks.test.js: Login response status: ${loginRes.status}, body:`, loginRes.body);
      if (loginRes.status !== 200 || !loginRes.body.token) {
        throw new Error(`tasks.test.js: Login failed. Status: ${loginRes.status}, Body: ${JSON.stringify(loginRes.body)}`);
      }

      testUserToken = loginRes.body.token;
      testUserId = loginRes.body.user.id; // Use ID from login response
      console.log(`tasks.test.js: User logged in successfully. Token obtained. User ID: ${testUserId}`);

      if (!testUserToken || !testUserId) {
        throw new Error("tasks.test.js: Test user token or ID was not set after login.");
      }
    } catch (error) {
      console.error("tasks.test.js: CRITICAL: Auth setup failed.", error);
      // No process.exit here
    }
  });

  beforeEach(async () => {
    const db = await getDb(); // Get DB instance for direct use
    if (db && testUserId) { 
        await db.run('DELETE FROM tasks WHERE userId = ?', [testUserId]);
    } else if (db) {
        // This else if might be redundant if testUserId is always expected to be set
        // or if __clearTasksTableForTesting is preferred when testUserId is not available.
        // For now, it's okay.
        await taskService.__clearTasksTableForTesting(); 
    }
    // If db is null here, it means getDb() failed, which should be caught by the new DB logic.
  });

  afterAll(async () => {
    await closeDb(); // Close DB connection after all tests in this file
    // Optional: Clean up users table after all tests
    // await taskService.__clearUsersTableForTesting();
  });


  // --- Task Endpoint Tests (Now with Authentication) ---
  describe('GET /api/tasks', () => {
    it('should return an empty list of tasks for the authenticated user if no tasks exist', async () => {
      if (!testUserToken) return; // Skip test if auth setup failed
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks).toEqual([]);
      expect(res.body.total).toEqual(0);
    });

    it('should fail to get tasks without a token', async () => {
        const res = await request(app).get('/api/tasks');
        expect(res.statusCode).toEqual(401);
        expect(res.body).toHaveProperty('message', 'Unauthorized: No token provided');
    });

     it('should fail to get tasks with an invalid/expired token', async () => {
        const res = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer aninvalidtoken123`);
        expect(res.statusCode).toEqual(403);
        expect(res.body).toHaveProperty('message', 'Forbidden: Invalid token');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task for the authenticated user', async () => {
      if (!testUserToken) return; // Skip test if auth setup failed
      const newTaskData = { title: 'Test Task Auth', description: 'Test Description Auth' };
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(newTaskData);
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe(newTaskData.title);
      expect(res.body.userId).toBe(testUserId);
      expect(res.body.tags).toEqual([]); // Expect empty tags array by default
    });

    it('should create a new task with specified tags', async () => {
      if (!testUserToken) return;
      const newTaskData = {
        title: 'Task With Tags',
        description: 'This task has tags',
        tags: ['work', 'important', ' projectX '], // Add a tag with spaces to test trimming
      };
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(newTaskData);
      
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe(newTaskData.title);
      expect(res.body.userId).toBe(testUserId);
      expect(res.body.tags).toBeInstanceOf(Array);
      expect(res.body.tags.length).toBe(3);
      // Tags should be returned sorted by name or ID, let's check for names
      const tagNames = res.body.tags.map(t => t.name).sort();
      expect(tagNames).toEqual(['important', 'projectx', 'work']); // projectX should be trimmed

      // Verify tags were created in the database (optional direct check)
      const db = await getDb();
      const createdTags = await db.all('SELECT name FROM tags WHERE name IN (?, ?, ?)', ['work', 'important', 'projectX']);
      expect(createdTags.length).toBe(3);
    });

    it('should create a new task with specified tags', async () => {
      // ... existing setup ...
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'New Task with Tags', tags: ['Work', ' Important ', ' projectX '] }); // Mixed case and spaces
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.tags).toBeInstanceOf(Array);
      expect(res.body.tags.length).toBe(3);
      const tagNames = res.body.tags.map(t => t.name).sort();
      // EXPECTATION CHANGE:
      expect(tagNames).toEqual(['important', 'projectx', 'work']); 

      const db = await getDb();
      // EXPECTATION CHANGE (for direct DB check, assuming you store them lowercase):
      const createdTags = await db.all('SELECT name FROM tags WHERE name IN (?, ?, ?)', ['work', 'important', 'projectx']);
      expect(createdTags.length).toBe(3);
    });

    it('should create a task with duplicate tags in input, but store them uniquely', async () => {
      if (!testUserToken) return;
      const newTaskData = {
        title: 'Task With Duplicate Tags Input',
        tags: ['duplicate', 'unique', 'duplicate', ' DUPLICATE  '], // Test case-insensitivity and trimming for uniqueness
      };
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(newTaskData);
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.tags).toBeInstanceOf(Array);
      expect(res.body.tags.length).toBe(2); // 'duplicate' and 'unique'
      const tagNames = res.body.tags.map(t => t.name).sort();
      expect(tagNames).toEqual(['duplicate', 'unique']);
    });

    it('should create a task with an empty tags array', async () => {
      if (!testUserToken) return;
      const newTaskData = {
        title: 'Task With Empty Tags Array',
        tags: [],
      };
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(newTaskData);
      
      expect(res.statusCode).toEqual(201);
      expect(res.body.tags).toEqual([]);
    });

    it('should fail to create a task without a token', async () => {
        const res = await request(app)
            .post('/api/tasks')
            .send({ title: 'Unauthorized Task' });
        expect(res.statusCode).toEqual(401);
    });

    it('should return 400 for invalid task data (e.g. missing title) when authenticated', async () => {
      if (!testUserToken) return; // Skip test if auth setup failed
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ description: 'Missing title' }); // No title
      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors).toBeInstanceOf(Array);
      // FIX: Check for an object with the specific field and message
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: 'title is required' 
          })
        ])
      );
    });
  });

  describe('GET /api/tasks/:id', () => {
    let createdTask;
    let taskWithTags;

    beforeEach(async () => {
      if (!testUserToken) return; // Don't create task if no token
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Task for GET ID Auth', description: 'Details Auth' });
      createdTask = response.body;

      const responseWithTags = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Task for GET ID with Tags', tags: ['api-test', 'get-by-id'] });
      taskWithTags = responseWithTags.body;
    });

    it('should get a specific task by ID for the authenticated user', async () => {
      if (!testUserToken || !createdTask) return; // Skip test if auth setup failed
      const res = await request(app)
        .get(`/api/tasks/${createdTask.id}`)
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', createdTask.id);
      expect(res.body.title).toBe('Task for GET ID Auth');
      expect(res.body.userId).toBe(testUserId);
      expect(res.body.tags).toEqual([]); // Expect empty tags for task created without them
    });

    it('should get a specific task by ID including its tags', async () => {
      if (!testUserToken || !taskWithTags) return;
      const res = await request(app)
        .get(`/api/tasks/${taskWithTags.id}`)
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id', taskWithTags.id);
      expect(res.body.tags).toBeInstanceOf(Array);
      expect(res.body.tags.length).toBe(2);
      const tagNames = res.body.tags.map(t => t.name).sort();
      expect(tagNames).toEqual(['api-test', 'get-by-id']);
    });

    it('should return 404 if task not found or not owned by user', async () => {
      if (!testUserToken) return; // Skip test if auth setup failed
      const res = await request(app)
        .get('/api/tasks/99999') // Non-existent ID
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Task not found or not owned by user');
    });

    it('should fail to get a task by ID without a token', async () => {
        if (!createdTask) return; // Skip if task creation failed
        const res = await request(app).get(`/api/tasks/${createdTask.id}`);
        expect(res.statusCode).toEqual(401);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    let taskToUpdate;

    beforeEach(async () => {
      if (!testUserToken) return; // Don't create task if no token
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Task to Update Auth', description: 'Initial Auth', tags: ['initial', 'old'] });
      taskToUpdate = response.body;
    });

    it('should update a task for the authenticated user (title and completed)', async () => {
      if (!testUserToken || !taskToUpdate) return; // Skip test if auth setup failed
      const res = await request(app)
        .put(`/api/tasks/${taskToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Updated Title Auth', completed: true });
      expect(res.statusCode).toEqual(200);
      expect(res.body.title).toBe('Updated Title Auth');
      expect(res.body.completed).toBe(true);
      expect(res.body.userId).toBe(testUserId);
      // Tags should remain unchanged if not provided in update
      expect(res.body.tags.map(t => t.name).sort()).toEqual(['initial', 'old']);
    });

    it('should update a task tags (add new, remove old)', async () => {
      if (!testUserToken || !taskToUpdate) return;
      const res = await request(app)
        .put(`/api/tasks/${taskToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ tags: ['newTag1', ' updatedTag2 '] }); // Test trimming
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.tags).toBeInstanceOf(Array);
      const tagNames = res.body.tags.map(t => t.name).sort();
      expect(tagNames).toEqual(['newtag1', 'updatedtag2']); // 'initial' and 'old' should be gone
    });

    it('should update a task tags (add new, remove old)', async () => {
      // ... existing setup for taskToUpdate ...
      const updatedTaskData = {
        title: 'Updated Task Title with New Tags',
        tags: ['newTag1', 'updatedTag2'] // 'initial' and 'old' should be removed
      };
      const res = await request(app)
        .put(`/api/tasks/${taskToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(updatedTaskData);

      expect(res.statusCode).toEqual(200);
      expect(res.body.title).toBe(updatedTaskData.title);
      expect(res.body.tags).toBeInstanceOf(Array);
      const tagNames = res.body.tags.map(t => t.name).sort();
      // EXPECTATION CHANGE:
      expect(tagNames).toEqual(['newtag1', 'updatedtag2']); 
    });

    it('should remove all tags from a task if an empty tags array is provided', async () => {
      if (!testUserToken || !taskToUpdate) return;
      const res = await request(app)
        .put(`/api/tasks/${taskToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ tags: [] });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body.tags).toEqual([]);
    });
    
    it('should create new tags if they dont exist during update', async () => {
      if (!testUserToken || !taskToUpdate) return;
      const res = await request(app)
        .put(`/api/tasks/${taskToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ tags: ['brandNewTag', 'anotherNewOne'] });
      
      expect(res.statusCode).toEqual(200);
      const tagNames = res.body.tags.map(t => t.name).sort();
      expect(tagNames).toEqual(['anothernewone', 'brandnewtag']);

      const db = await getDb();
      const newDbTags = await db.all('SELECT name FROM tags WHERE name IN (?, ?)', ['brandNewTag', 'anotherNewOne']);
      expect(newDbTags.length).toBe(2);
    });

    it('should create new tags if they dont exist during update', async () => {
      // ... existing setup for taskToUpdate ...
      const updatedTaskData = {
        tags: ['brandNewTag', 'anotherNewOne']
      };
      const res = await request(app)
        .put(`/api/tasks/${taskToUpdate.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(updatedTaskData);

      expect(res.statusCode).toEqual(200);
      const tagNames = res.body.tags.map(t => t.name).sort();
      // EXPECTATION CHANGE:
      expect(tagNames).toEqual(['anothernewone', 'brandnewtag']);

      const db = await getDb();
      // EXPECTATION CHANGE (for direct DB check):
      const newDbTags = await db.all('SELECT name FROM tags WHERE name IN (?, ?)', ['brandnewtag', 'anothernewone']);
      expect(newDbTags.length).toBe(2);
      expect(newDbTags.map(t => t.name).sort()).toEqual(['anothernewone', 'brandnewtag']);
    });

    it('should return 404 if task to update not found or not owned by user', async () => {
      if (!testUserToken) return; // Skip test if auth setup failed
      const res = await request(app)
        .put('/api/tasks/99999')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Non Existent' });
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Task not found or not owned by user');
    });

    it('should fail to update a task without a token', async () => {
        if (!taskToUpdate) return; // Skip if task creation failed
        const res = await request(app)
            .put(`/api/tasks/${taskToUpdate.id}`)
            .send({ title: 'Unauthorized Update' });
        expect(res.statusCode).toEqual(401);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    let taskToDelete;

    beforeEach(async () => {
      if (!testUserToken) return; // Don't create task if no token
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Task to Delete Auth' });
      taskToDelete = response.body;
    });

    it('should delete a task for the authenticated user', async () => {
      if (!testUserToken || !taskToDelete) return; // Skip test if auth setup failed
      
      // Optional: Verify task_tags exist before delete if task had tags
      const db = await getDb();
      // Create a task with tags specifically for this delete test
      const taskWithTagsToDeleteRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ title: 'Task with Tags to Delete', tags: ['deleteme', 'cascade'] });
      const taskWithTagsToDelete = taskWithTagsToDeleteRes.body;
      
      let taskTags = await db.all('SELECT * FROM task_tags WHERE task_id = ?', [taskWithTagsToDelete.id]);
      expect(taskTags.length).toBe(2); // Ensure tags were associated

      const res = await request(app)
        .delete(`/api/tasks/${taskWithTagsToDelete.id}`)
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(204);

      const getRes = await request(app)
        .get(`/api/tasks/${taskWithTagsToDelete.id}`)
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(getRes.statusCode).toEqual(404);

      // Verify task_tags were cascaded
      taskTags = await db.all('SELECT * FROM task_tags WHERE task_id = ?', [taskWithTagsToDelete.id]);
      expect(taskTags.length).toBe(0);
    });

    it('should return 404 if task to delete not found or not owned by user', async () => {
      if (!testUserToken) return; // Skip test if auth setup failed
      const res = await request(app)
        .delete('/api/tasks/99999')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('message', 'Task not found or not owned by user');
    });

     it('should fail to delete a task without a token', async () => {
        if (!taskToDelete) return; // Skip if task creation failed
        const res = await request(app).delete(`/api/tasks/${taskToDelete.id}`);
        expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/tasks with pagination, filtering, sorting (authenticated)', () => {
    beforeEach(async () => {
        if (!testUserToken) return; // Don't create tasks if no token
        // Create some tasks for the test user
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Task A Auth (old, completed)', completed: true, description: 'alpha', tags: ['common', 'alpha-tag', 'filter-test'] });
        await new Promise(resolve => setTimeout(resolve, 10)); // Ensure different createdAt
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Task C Auth (new, incomplete)', completed: false, description: 'gamma', tags: ['common', 'gamma-tag', 'filter-test'] });
        await new Promise(resolve => setTimeout(resolve, 10));
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Task B Auth (mid, incomplete)', completed: false, description: 'beta', tags: ['beta-tag', 'filter-test', 'unique-to-B'] });
        await new Promise(resolve => setTimeout(resolve, 10));
        await request(app).post('/api/tasks').set('Authorization', `Bearer ${testUserToken}`).send({ title: 'Task D Auth (no common tag)', completed: false, description: 'delta', tags: ['delta-tag'] });
    });

    it('should filter tasks by completion status (completed=true) and include tags', async () => {
        if (!testUserToken) return; // Skip test if auth setup failed
        const res = await request(app)
            .get('/api/tasks?completed=true')
            .set('Authorization', `Bearer ${testUserToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
        res.body.tasks.forEach(task => {
          expect(task.completed).toBe(true);
          expect(task.tags).toBeInstanceOf(Array); // Check tags are present
          if (task.title.includes('Task A')) {
            expect(task.tags.map(t=>t.name).sort()).toEqual(['alpha-tag', 'common', 'filter-test']);
          }
        });
    });

    it('should sort tasks by title ascending (title_ASC) and include tags', async () => {
        if (!testUserToken) return; // Skip test if auth setup failed
        const res = await request(app)
            .get('/api/tasks?sortBy=title_ASC')
            .set('Authorization', `Bearer ${testUserToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.tasks.length).toBeGreaterThanOrEqual(3);
        expect(res.body.tasks[0].title).toMatch(/Task A Auth/);
        expect(res.body.tasks[0].tags.map(t=>t.name).sort()).toEqual(['alpha-tag', 'common', 'filter-test']);
        expect(res.body.tasks[1].title).toMatch(/Task B Auth/);
        expect(res.body.tasks[1].tags.map(t=>t.name).sort()).toEqual(['beta-tag', 'filter-test', 'unique-to-b']);
        expect(res.body.tasks[2].title).toMatch(/Task C Auth/);
        expect(res.body.tasks[2].tags.map(t=>t.name).sort()).toEqual(['common', 'filter-test', 'gamma-tag']);
    });

    it('should sort tasks by title ascending (title_ASC) and include tags', async () => {
      // ... existing setup ...
      const res = await request(app)
        .get('/api/tasks?sortBy=title_ASC&limit=3')
        .set('Authorization', `Bearer ${testUserToken}`);
      // ... existing assertions for task order and titles ...
      expect(res.body.tasks[0].tags.map(t=>t.name).sort()).toEqual(['alpha-tag', 'common', 'filter-test']); // Assuming these were already canonical or test data needs update
      expect(res.body.tasks[1].title).toMatch(/Task B Auth/);
      // EXPECTATION CHANGE:
      expect(res.body.tasks[1].tags.map(t=>t.name).sort()).toEqual(['beta-tag', 'filter-test', 'unique-to-b']);
      expect(res.body.tasks[2].title).toMatch(/Task C Auth/);
      expect(res.body.tasks[2].tags.map(t=>t.name).sort()).toEqual(['common', 'filter-test', 'gamma-tag']); // Assuming these were already canonical
    });

    it('should paginate tasks (page=1, limit=1) and include tags', async () => {
        if (!testUserToken) return; // Skip test if auth setup failed
        const res = await request(app)
            .get('/api/tasks?page=1&limit=1&sortBy=createdAt_ASC') // Sort by createdAt_ASC to get predictable first item
            .set('Authorization', `Bearer ${testUserToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.tasks.length).toBe(1);
        expect(res.body.total).toBeGreaterThanOrEqual(3);
        expect(res.body.page).toBe(1);
        expect(res.body.limit).toBe(1);
        expect(res.body.tasks[0].title).toMatch(/Task A Auth/); // Assuming Task A was created first
        expect(res.body.tasks[0].tags.map(t=>t.name).sort()).toEqual(['alpha-tag', 'common', 'filter-test']);
    });

    // New tests for filtering by tags
    it('should filter tasks by a single tag', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=common')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(2); // Task A and Task C have 'common'
      res.body.tasks.forEach(task => {
        expect(task.tags.map(t => t.name)).toContain('common');
      });
    });

    it('should filter tasks by multiple tags (AND logic - must have all specified tags)', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=filter-test,common')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(2); // Task A and Task C have both 'filter-test' and 'common'
      res.body.tasks.forEach(task => {
        const taskTagNames = task.tags.map(t => t.name);
        expect(taskTagNames).toContain('filter-test');
        expect(taskTagNames).toContain('common');
      });
    });
    
    it('should filter tasks by multiple tags including one unique to a task', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=filter-test,unique-to-B')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(1); // Only Task B has both 'filter-test' and 'unique-to-B'
      expect(res.body.tasks[0].title).toMatch(/Task B Auth/);
    });

    it('should return an empty list if no tasks match all specified tags', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=common,nonexistenttag')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(0);
    });

    it('should handle tags with spaces in the query parameter (e.g., " tag1 , tag2 ")', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags= common , beta-tag ') // Tags with spaces
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      // Task B has 'beta-tag'. Task A and C have 'common'.
      // If ' common ' and ' beta-tag ' are queried, only tasks with BOTH should appear.
      // Based on current setup, only Task B has 'beta-tag'. Task A & C have 'common'. No task has both.
      // Let's adjust the expectation. If we search for "common, beta-tag", no task has both.
      // If we search for "filter-test, beta-tag", Task B should be found.
      const resFiltered = await request(app)
        .get('/api/tasks?tags= filter-test , beta-tag ') // Tags with spaces
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(resFiltered.statusCode).toEqual(200);
      expect(resFiltered.body.tasks.length).toBe(1);
      expect(resFiltered.body.tasks[0].title).toMatch(/Task B Auth/);
    });
    
    it('should combine tag filtering with other filters like completion status', async () => {
      if (!testUserToken) return;
      // Task A is: completed=true, tags: ['common', 'alpha-tag', 'filter-test']
      // Task C is: completed=false, tags: ['common', 'gamma-tag', 'filter-test']
      const res = await request(app)
        .get('/api/tasks?tags=common,filter-test&completed=true')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0].title).toMatch(/Task A Auth/);
      expect(res.body.tasks[0].completed).toBe(true);
      const taskTagNames = res.body.tasks[0].tags.map(t => t.name);
      expect(taskTagNames).toContain('common');
      expect(taskTagNames).toContain('filter-test');
    });

    // New tests for tagMatchMode
    it('should filter tasks by a single tag (defaulting to tagMatchMode=all)', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=common')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(2); // Task A and Task C have 'common'
      res.body.tasks.forEach(task => {
        expect(task.tags.map(t => t.name)).toContain('common');
      });
    });

    it('should filter tasks by multiple tags with tagMatchMode=all (explicit)', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=filter-test,common&tagMatchMode=all')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(2); // Task A and Task C have both
      res.body.tasks.forEach(task => {
        const taskTagNames = task.tags.map(t => t.name);
        expect(taskTagNames).toContain('filter-test');
        expect(taskTagNames).toContain('common');
      });
    });
    
    it('should filter tasks by multiple tags with tagMatchMode=all (default behavior)', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=filter-test,common') // No tagMatchMode, should default to 'all'
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(2); // Task A and Task C have both
    });

    it('should filter tasks by multiple tags with tagMatchMode=any', async () => {
      if (!testUserToken) return;
      // Tags: 'common' (A, C), 'beta-tag' (B)
      const res = await request(app)
        .get('/api/tasks?tags=common,beta-tag&tagMatchMode=any')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      // Task A (common), Task B (beta-tag), Task C (common) = 3 tasks
      expect(res.body.tasks.length).toBe(3); 
      const titles = res.body.tasks.map(t => t.title).sort();
      expect(titles).toEqual(['Task A Auth (old, completed)', 'Task B Auth (mid, incomplete)', 'Task C Auth (new, incomplete)']);
    });

    it('should filter tasks by a single tag with tagMatchMode=any', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=delta-tag&tagMatchMode=any')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(1); // Only Task D has 'delta-tag'
      expect(res.body.tasks[0].title).toMatch(/Task D Auth/);
    });
    
    it('should return an empty list if no tasks match any specified tags with tagMatchMode=any', async () => {
      if (!testUserToken) return;
      const res = await request(app)
        .get('/api/tasks?tags=nonexistenttag1,nonexistenttag2&tagMatchMode=any')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(0);
    });

    it('should combine tagMatchMode=any with other filters like completion status', async () => {
      if (!testUserToken) return;
      // Task A: completed=true, tags: ['common', 'alpha-tag', 'filter-test']
      // Task B: completed=false, tags: ['beta-tag', 'filter-test', 'unique-to-B']
      // Task C: completed=false, tags: ['common', 'gamma-tag', 'filter-test']
      // Task D: completed=false, tags: ['delta-tag']
      // Query: tags=common,beta-tag (OR) AND completed=false
      // Expected: Task B (beta-tag, completed=false), Task C (common, completed=false)
      const res = await request(app)
        .get('/api/tasks?tags=common,beta-tag&tagMatchMode=any&completed=false')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(2);
      const titles = res.body.tasks.map(t => t.title).sort();
      expect(titles).toEqual(['Task B Auth (mid, incomplete)', 'Task C Auth (new, incomplete)']);
      res.body.tasks.forEach(task => {
        expect(task.completed).toBe(false);
        const taskTagNames = task.tags.map(t => t.name);
        expect(taskTagNames.includes('common') || taskTagNames.includes('beta-tag')).toBe(true);
      });
    });
    
    it('should correctly count total tasks with tagMatchMode=any and pagination', async () => {
      if (!testUserToken) return;
      // Tags: 'filter-test' (A, B, C), 'delta-tag' (D)
      // tagMatchMode=any should find all 4 tasks.
      const res = await request(app)
        .get('/api/tasks?tags=filter-test,delta-tag&tagMatchMode=any&limit=2&page=1')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.tasks.length).toBe(2);
      expect(res.body.total).toBe(4); // All tasks A, B, C, D match one of these tags
      expect(res.body.totalPages).toBe(2);
    });

    it('should correctly count total tasks with tagMatchMode=all and pagination', async () => {
        if (!testUserToken) return;
        // Tags: 'filter-test' (A, B, C), 'common' (A, C)
        // tagMatchMode=all for 'filter-test,common' should find tasks A, C (2 tasks)
        const res = await request(app)
          .get('/api/tasks?tags=filter-test,common&tagMatchMode=all&limit=1&page=1')
          .set('Authorization', `Bearer ${testUserToken}`);
        expect(res.statusCode).toEqual(200);
        expect(res.body.tasks.length).toBe(1);
        expect(res.body.total).toBe(2); 
        expect(res.body.totalPages).toBe(2);
      });
  });
});