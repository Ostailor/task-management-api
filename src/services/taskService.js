const { getDb } = require('../database');

// Helper function to transform task from DB format (completed as 0/1) to JS format (boolean)
const transformTaskFromDb = (task) => {
  if (task) {
    // Explicitly convert 0 to false, 1 to true.
    // Also handles cases where task.completed might be null or undefined from DB, treating them as false.
    const newCompleted = task.completed === 1; // More explicit than !!task.completed for 0/1
    // console.log(`Transforming task ID ${task.id}: DB completed was ${task.completed, JS completed is ${newCompleted}`); // Optional debug log
    return {
      ...task,
      completed: newCompleted,
    };
  }
  return undefined; // Or null, if you prefer for "not found"
};

const transformTasksFromDb = (tasks) => {
  return tasks.map(task => transformTaskFromDb(task));
};

// New function to find or create a tag
const findOrCreateTag = async (name) => {
  const db = await getDb();
  const originalTrimmedTagName = name.trim();
  if (!originalTrimmedTagName) return null;

  // Always work with a canonical (lowercase) version of the tag name
  const canonicalTagName = originalTrimmedTagName.toLowerCase();

  // Try to find the tag using its canonical name.
  // The `tags.name` column has `COLLATE NOCASE`, so direct comparison works if DB stores mixed case,
  // but it's better to query based on the canonical form if we intend to store it that way.
  // For robustness, especially if existing data might not be canonical, query with lower().
  let tag = await db.get('SELECT id, name FROM tags WHERE lower(name) = lower(?)', [canonicalTagName]);

  if (!tag) {
    try {
      // If not found, insert the canonical (lowercase) name.
      const result = await db.run('INSERT INTO tags (name) VALUES (?)', [canonicalTagName]);
      tag = { id: result.lastID, name: canonicalTagName };
    } catch (e) {
      // This catch block handles the rare case where the SELECT missed the tag,
      // but the INSERT failed due to the UNIQUE constraint (e.g., a race condition).
      if (e.message && e.message.includes('SQLITE_CONSTRAINT') && e.message.includes('tags.name')) {
        // The tag must exist, so we try to fetch it again using the canonical name.
        tag = await db.get('SELECT id, name FROM tags WHERE lower(name) = lower(?)', [canonicalTagName]);
        if (!tag) {
          // This would be an unexpected state.
          console.error(`CRITICAL: Tag "${canonicalTagName}" insert failed and could not be re-fetched after constraint violation.`);
          throw e; // Re-throw original error if re-fetch also fails
        }
      } else {
        throw e; // Re-throw other errors
      }
    }
  } else {
    // If the tag was found but its stored name isn't in the canonical form (e.g. due to old data),
    // return it with the canonical name for consistency in the application.
    // The actual DB record will still have its stored casing until/unless updated.
    // For this fix, we'll assume the SELECT query returns the name as stored,
    // and we want the returned object to reflect the canonical name.
    tag.name = canonicalTagName;
  }
  return tag; // Ensures tag.name is the canonical (lowercase) form
};

// New function to get tags for a specific task
const getTagsForTask = async (taskId) => {
  const db = await getDb();
  return db.all(`
    SELECT t.id, t.name
    FROM tags t
    JOIN task_tags tt ON t.id = tt.tag_id
    WHERE tt.task_id = ?
  `, [taskId]);
};

// New function to add tags to a task
const addTagsToTask = async (taskId, tagNames, userId) => {
  if (!tagNames || tagNames.length === 0) {
    return; // No tags to add
  }
  const db = await getDb();
  // First, ensure the task exists and belongs to the user (optional, but good practice)
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND userId = ?', [taskId, userId]);
  if (!task) {
    console.warn(`addTagsToTask: Task ${taskId} not found or not owned by user ${userId}.`);
    return; // Or throw an error
  }

  const tagPromises = tagNames.map(name => findOrCreateTag(name));
  const tags = (await Promise.all(tagPromises)).filter(tag => tag !== null); // Filter out nulls if any tag names were empty

  if (tags.length > 0) {
    const insertPromises = tags.map(tag => {
      return db.run('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)', [taskId, tag.id]);
    });
    await Promise.all(insertPromises);
  }
};

// Helper function to remove all tags for a task before adding new ones (simplifies update logic)
const clearTagsForTask = async (taskId) => {
  const db = await getDb();
  await db.run('DELETE FROM task_tags WHERE task_id = ?', [taskId]);
};

// Get all tasks with pagination, filtering, and sorting
const getAllTasks = async (userId, options = {}) => {
  const db = await getDb();
  let query = `
    SELECT DISTINCT t.id, t.title, t.description, t.completed, t.createdAt, t.updatedAt, t.userId 
    FROM tasks t
  `;
  const queryParams = [];
  
  let joins = '';
  const whereClauses = ['t.userId = ?'];
  queryParams.push(userId);

  let tagNamesToFilter = [];
  const tagMatchMode = options.tagMatchMode || 'all'; // 'all' (AND) or 'any' (OR)

  if (options.tags && typeof options.tags === 'string') {
    tagNamesToFilter = options.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
    if (tagNamesToFilter.length > 0) {
      joins += `
        INNER JOIN task_tags tt ON t.id = tt.task_id
        INNER JOIN tags ta ON tt.tag_id = ta.id
      `;
      const tagPlaceholders = tagNamesToFilter.map(() => 'lower(?)').join(',');
      whereClauses.push(`lower(ta.name) IN (${tagPlaceholders})`);
      queryParams.push(...tagNamesToFilter);
    }
  }

  if (options.completed !== undefined) {
    whereClauses.push('t.completed = ?');
    const completedValue = options.completed === 'true' || options.completed === true ? 1 : 0;
    queryParams.push(completedValue);
  }

  query += joins;

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }
  
  // For AND logic (match all tags), we need GROUP BY and HAVING
  if (tagNamesToFilter.length > 0 && tagMatchMode === 'all') {
    query += ` GROUP BY t.id, t.title, t.description, t.completed, t.createdAt, t.updatedAt, t.userId HAVING COUNT(DISTINCT lower(ta.name)) = ?`;
    queryParams.push(tagNamesToFilter.length);
  } else if (tagNamesToFilter.length > 0 && tagMatchMode === 'any') {
    // For OR logic, the DISTINCT in the main SELECT and the WHERE IN clause are sufficient.
    // However, if other GROUP BY clauses were necessary for other reasons, we'd still need to group.
    // For now, we only add GROUP BY if it's for the 'all' tags mode.
    // If not 'all' mode, and tags are present, the DISTINCT t.id in SELECT handles duplicates.
  }


  // --- Count Query Logic ---
  let countQuery;
  const countQueryParams = []; // Re-initialize for count query
  
  // Base for count query
  let countBase = `FROM tasks t`;
  let countJoins = '';
  const countWhereClauses = ['t.userId = ?'];
  countQueryParams.push(userId);

  if (tagNamesToFilter.length > 0) {
    countJoins += `
      INNER JOIN task_tags tt_count ON t.id = tt_count.task_id
      INNER JOIN tags ta_count ON tt_count.tag_id = ta_count.id
    `;
    const tagPlaceholdersCount = tagNamesToFilter.map(() => 'lower(?)').join(',');
    countWhereClauses.push(`lower(ta_count.name) IN (${tagPlaceholdersCount})`);
    countQueryParams.push(...tagNamesToFilter);
  }

  if (options.completed !== undefined) {
    countWhereClauses.push('t.completed = ?');
    countQueryParams.push(options.completed === 'true' || options.completed === true ? 1 : 0);
  }

  countBase += countJoins;
  if (countWhereClauses.length > 0) {
    countBase += ' WHERE ' + countWhereClauses.join(' AND ');
  }

  if (tagNamesToFilter.length > 0 && tagMatchMode === 'all') {
    // Count for AND logic (match all tags)
    countQuery = `SELECT COUNT(*) as total FROM (SELECT DISTINCT t.id ${countBase} GROUP BY t.id HAVING COUNT(DISTINCT lower(ta_count.name)) = ?)`;
    countQueryParams.push(tagNamesToFilter.length); // Add the count of tags for the HAVING clause
  } else if (tagNamesToFilter.length > 0 && tagMatchMode === 'any') {
    // Count for OR logic (match any tag)
    countQuery = `SELECT COUNT(DISTINCT t.id) as total ${countBase}`;
    // queryParams for count are already set
  } else {
    // Count when no tag filtering is applied
    countQuery = `SELECT COUNT(t.id) as total ${countBase}`;
    // queryParams for count are already set
  }
  // --- End Count Query Logic ---

  const { total } = await db.get(countQuery, countQueryParams);

  // Sorting - must happen AFTER GROUP BY if GROUP BY is used
  if (options.sortBy) {
    const [field, order] = options.sortBy.split('_');
    const allowedFields = ['createdAt', 'updatedAt', 'title', 'completed'];
    const sortOrder = order && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    if (allowedFields.includes(field)) {
      query += ` ORDER BY t.${field} ${sortOrder}`;
    }
  } else {
    query += ' ORDER BY t.createdAt DESC'; 
  }

  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 10;
  const offset = (page - 1) * limit;

  query += ' LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const tasksFromDb = await db.all(query, queryParams);

  const tasksWithTags = await Promise.all(tasksFromDb.map(async (task) => {
    const tags = await getTagsForTask(task.id);
    return { ...transformTaskFromDb(task), tags };
  }));

  return {
    tasks: tasksWithTags,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get a single task by ID
const getTaskById = async (id, userId) => { // Add userId
  const db = await getDb();
  const taskFromDb = await db.get('SELECT id, title, description, completed, createdAt, updatedAt, userId FROM tasks WHERE id = ? AND userId = ?', [parseInt(id), userId]);
  // return transformTaskFromDb(taskFromDb); // Modified below
  if (!taskFromDb) {
    return undefined;
  }
  const transformedTask = transformTaskFromDb(taskFromDb);
  const tags = await getTagsForTask(transformedTask.id);
  return { ...transformedTask, tags };
};

// Create a new task
const createTask = async (taskData, userId) => { // Add userId
  const db = await getDb();
  const { title, description, tags: tagNames } = taskData; // Destructure tags
  // Ensure 'completed' is a boolean for DB insertion (driver handles 0/1)
  const completedInput = taskData.completed === undefined ? false : !!taskData.completed;
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;

  const result = await db.run(
    'INSERT INTO tasks (title, description, completed, createdAt, updatedAt, userId) VALUES (?, ?, ?, ?, ?, ?)',
    [title, description || '', completedInput, createdAt, updatedAt, userId]
  );
  const newTaskId = result.lastID;

  // Add tags if provided
  if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
    await addTagsToTask(newTaskId, tagNames, userId);
  }

  // Fetch the newly created task using getTaskById, which includes transformation and tags
  return getTaskById(newTaskId, userId); // Pass userId here
};

// Update an existing task
const updateTask = async (id, updateData, userId) => { // Add userId
  const db = await getDb();
  // Fetch existing task (it will be transformed, so existingTask.completed is boolean)
  const existingTask = await getTaskById(id, userId); // Check ownership & get current tags
  if (!existingTask) {
    return null; // Task not found or doesn't belong to user
  }

  const newTitle = updateData.title !== undefined ? updateData.title : existingTask.title;
  const newDescription = updateData.description !== undefined ? updateData.description : existingTask.description;
  // Ensure 'completed' for update is boolean (driver handles 0/1 for DB)
  // existingTask.completed is already a JS boolean here.
  const newCompletedInput = updateData.completed !== undefined ? !!updateData.completed : existingTask.completed;
  const newUpdatedAt = new Date().toISOString();

  await db.run(
    'UPDATE tasks SET title = ?, description = ?, completed = ?, updatedAt = ? WHERE id = ? AND userId = ?',
    [newTitle, newDescription, newCompletedInput, newUpdatedAt, parseInt(id), userId]
  );

  // Handle tags update: clear existing and add new ones if provided
  if (updateData.tags !== undefined) { // Check if 'tags' key is present in updateData
    await clearTagsForTask(id);
    if (Array.isArray(updateData.tags) && updateData.tags.length > 0) {
      await addTagsToTask(id, updateData.tags, userId);
    }
  }

  // Fetch the updated task using getTaskById, which includes transformation and tags
  return getTaskById(id, userId);
};

// Delete a task
const deleteTask = async (id, userId) => { // Add userId
  const db = await getDb();
  // Ensure the task belongs to the user before deleting
  const result = await db.run('DELETE FROM tasks WHERE id = ? AND userId = ?', [parseInt(id), userId]);
  // Note: task_tags will be deleted automatically due to ON DELETE CASCADE
  return result.changes > 0;
};

const __clearTasksTableForTesting = async () => {
  const db = await getDb();
  await db.run('DELETE FROM tasks');
  await db.run('DELETE FROM tags'); // Clear tags table
  await db.run('DELETE FROM task_tags'); // Clear task_tags table
  await db.run("DELETE FROM sqlite_sequence WHERE name='tags';"); // Optional: reset tags auto-increment
  // await db.run("DELETE FROM sqlite_sequence WHERE name='tasks';"); // Optional
};

const __clearUsersTableForTesting = async () => { // For testing auth
    const db = await getDb();
    await db.run('DELETE FROM users');
    await db.run("DELETE FROM sqlite_sequence WHERE name='users';"); // Reset auto-increment for users
};

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  __clearTasksTableForTesting,
  __clearUsersTableForTesting,
  // Export new functions for potential direct use or testing
  findOrCreateTag,
  getTagsForTask,
  addTagsToTask,
  clearTagsForTask,
};