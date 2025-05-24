const taskService = require('../src/services/taskService');
const { initializeDatabase, closeDb, getDb } = require('../src/database');

describe('Task Service with SQLite Persistence', () => {
  const testUserId = 1; 
  const testUsername = `service-test-user-${testUserId}`;

  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDb(); 
  });

  beforeEach(async () => {
    await taskService.__clearTasksTableForTesting();
    await taskService.__clearUsersTableForTesting(); 

    const db = await getDb();
    const now = new Date().toISOString();
    try {
      await db.run(
        'INSERT INTO users (id, username, password, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [testUserId, testUsername, 'testpasswordhash', `${testUsername}@example.com`, now, now]
      );
    } catch (error) {
      console.error(`[taskService.test.js] Error inserting test user (ID: ${testUserId}):`, error); // Kept critical error log
      throw error;
    }
  });

  test('should create a new task in the database for a user', async () => {
    const taskData = { title: 'DB Task Service', description: 'Stored in SQLite by Service' };
    const task = await taskService.createTask(taskData, testUserId); 
    expect(task).toHaveProperty('id');
    expect(task.title).toBe('DB Task Service');
    expect(task.description).toBe('Stored in SQLite by Service');
    expect(task.completed).toBe(false);
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
    expect(task.userId).toBe(testUserId);

    const result = await taskService.getAllTasks(testUserId, {}); 
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('DB Task Service');
  });

  test('should get all tasks from the database for a specific user', async () => {
    const otherUserId = 2;
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
        'INSERT INTO users (id, username, password, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [otherUserId, `service-user-${otherUserId}`, 'testpass', `service-user-${otherUserId}@example.com`, now, now]
    );
    
    await taskService.createTask({ title: 'User1 Task Alpha' }, testUserId);
    await taskService.createTask({ title: 'User1 Task Beta' }, testUserId);
    await taskService.createTask({ title: 'User2 Task Gamma' }, otherUserId);

    const result = await taskService.getAllTasks(testUserId, {}); 
    expect(result.tasks).toHaveLength(2);
    const titles = result.tasks.map(t => t.title);
    expect(titles).toContain('User1 Task Alpha');
    expect(titles).toContain('User1 Task Beta');
    expect(titles).not.toContain('User2 Task Gamma');
  });

  test('should get a task by ID from the database for a specific user', async () => {
    const task1 = await taskService.createTask({ title: 'Task for DB ID test Service' }, testUserId);
    const foundTask = await taskService.getTaskById(task1.id, testUserId); 
    
    expect(foundTask).toBeDefined();
    expect(foundTask.id).toEqual(task1.id);
    expect(foundTask.title).toEqual(task1.title);
    expect(foundTask.userId).toEqual(testUserId);
  });

  test('should return undefined when getting a task by ID not owned by the user', async () => {
    const otherUserId = 99;
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
        'INSERT INTO users (id, username, password, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [otherUserId, `service-user-${otherUserId}`, 'testpass', `service-user-${otherUserId}@example.com`, now, now]
    );
    const taskOtherUser = await taskService.createTask({ title: 'Other User Task' }, otherUserId); 
    const foundTask = await taskService.getTaskById(taskOtherUser.id, testUserId); 
    expect(foundTask).toBeUndefined();
  });

  test('should return undefined for a non-existent task ID (DB)', async () => {
    const foundTask = await taskService.getTaskById(99999, testUserId); 
    expect(foundTask).toBeUndefined();
  });

  test('should update an existing task in the database for a user', async () => {
    const originalTask = await taskService.createTask({ title: 'Original DB Title Service' }, testUserId);
    
    await new Promise(resolve => setTimeout(resolve, 10)); 

    const updates = { title: 'Updated DB Title Service', completed: true };
    const updatedTask = await taskService.updateTask(originalTask.id, updates, testUserId); 

    expect(updatedTask).toBeDefined();
    expect(updatedTask.title).toBe('Updated DB Title Service');
    expect(updatedTask.completed).toBe(true);
    expect(updatedTask.userId).toBe(testUserId);
    expect(new Date(updatedTask.updatedAt).getTime()).toBeGreaterThan(new Date(originalTask.updatedAt).getTime());

    const refetchedTask = await taskService.getTaskById(originalTask.id, testUserId); 
    expect(refetchedTask.title).toBe('Updated DB Title Service');
  });

  test('should return null when trying to update a task not owned by the user', async () => {
    const otherUserId = 99;
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
        'INSERT INTO users (id, username, password, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [otherUserId, `service-user-${otherUserId}`, 'testpass', `service-user-${otherUserId}@example.com`, now, now]
    );
    const taskOtherUser = await taskService.createTask({ title: 'Other User Task Update' }, otherUserId);
    const updates = { title: 'Attempted Update' };
    const updatedTask = await taskService.updateTask(taskOtherUser.id, updates, testUserId);
    expect(updatedTask).toBeNull();
  });

  test('should return null when trying to update a non-existent task (DB)', async () => {
    const updatedTask = await taskService.updateTask(99999, { title: 'Non Existent' }, testUserId); 
    expect(updatedTask).toBeNull();
  });

  test('should delete an existing task from the database for a user', async () => {
    const task = await taskService.createTask({ title: 'To Be Deleted from DB Service' }, testUserId);
    let initialResult = await taskService.getAllTasks(testUserId, {});
    expect(initialResult.tasks).toHaveLength(1);

    const result = await taskService.deleteTask(task.id, testUserId); 
    expect(result).toBe(true);

    const finalResult = await taskService.getAllTasks(testUserId, {});
    expect(finalResult.tasks).toHaveLength(0);
    const foundTask = await taskService.getTaskById(task.id, testUserId);
    expect(foundTask).toBeUndefined();
  });

  test('should return false when trying to delete a task not owned by the user', async () => {
    const otherUserId = 99;
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
        'INSERT INTO users (id, username, password, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [otherUserId, `service-user-${otherUserId}`, 'testpass', `service-user-${otherUserId}@example.com`, now, now]
    );
    const taskOtherUser = await taskService.createTask({ title: 'Other User Task Delete' }, otherUserId);
    const result = await taskService.deleteTask(taskOtherUser.id, testUserId);
    expect(result).toBe(false);
  });

  test('should return false when trying to delete a non-existent task (DB)', async () => {
    const result = await taskService.deleteTask(99999, testUserId); 
    expect(result).toBe(false);
  });
});