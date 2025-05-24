const { getDb } = require('../database');
const { AppError } = require('../utils/AppError');

/**
 * Retrieves all unique tags used by a specific user.
 * These are tags associated with the user's tasks.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<Array<{id: number, name: string}>>} A promise that resolves to an array of tag objects.
 */
const getAllTagsForUser = async (userId) => {
  const db = await getDb();
  const tags = await db.all(`
    SELECT DISTINCT t.id, t.name
    FROM tags t
    JOIN task_tags tt ON t.id = tt.tag_id
    JOIN tasks task ON tt.task_id = task.id
    WHERE task.userId = ? 
    ORDER BY lower(t.name) ASC
  `, [userId]);
  return tags;
};

/**
 * Updates a tag's name. This is a global name change for the tag ID.
 * A user can only initiate this update if they have at least one task associated with that tag.
 * @param {number} tagId - The ID of the tag to update.
 * @param {string} newName - The new name for the tag.
 * @param {number} userId - The ID of the user requesting the update.
 * @returns {Promise<{id: number, name: string}>} The updated tag object.
 */
const updateTag = async (tagId, newName, userId) => {
  const db = await getDb();
  const originalTrimmedNewName = newName.trim();

  if (!originalTrimmedNewName) {
    throw new AppError('New tag name cannot be empty.', 400);
  }
  const canonicalNewName = originalTrimmedNewName.toLowerCase();

  const existingTag = await db.get('SELECT id, name FROM tags WHERE id = ?', [tagId]);
  if (!existingTag) {
    throw new AppError('Tag not found.', 404);
  }

  // User-scoping: Check if the user has a task using this tag, granting permission to update.
  const userUsesTag = await db.get(`
    SELECT 1 FROM task_tags tt
    JOIN tasks t ON tt.task_id = t.id
    WHERE tt.tag_id = ? AND t.userId = ?
    LIMIT 1
  `, [tagId, userId]);

  if (!userUsesTag) {
    throw new AppError('You do not have permission to update this tag as it is not associated with your tasks.', 403);
  }

  // Check if the new canonical name conflicts with another existing tag (globally).
  const conflictingTag = await db.get(
    'SELECT id FROM tags WHERE lower(name) = ? AND id != ?',
    [canonicalNewName, tagId]
  );

  if (conflictingTag) {
    throw new AppError(`A tag with the name "${originalTrimmedNewName}" already exists.`, 409);
  }

  try {
    await db.run('UPDATE tags SET name = ? WHERE id = ?', [canonicalNewName, tagId]);
    return { id: tagId, name: canonicalNewName };
  } catch (error) {
    if (error.message && error.message.toUpperCase().includes('UNIQUE CONSTRAINT FAILED: TAGS.NAME')) {
        throw new AppError(`A tag with the name "${originalTrimmedNewName}" already exists (database constraint).`, 409);
    }
    // console.error(`Error updating tag ID ${tagId} in database:`, error); // Uncomment for debugging if needed
    throw new AppError('Could not update tag due to a server error.', 500);
  }
};

/**
 * Deletes a tag from the system.
 * A user can only initiate deletion of a tag if they have at least one task associated with it.
 * The tag is only actually deleted from the global 'tags' table if no tasks (from any user) are currently using it.
 * @param {number} tagId - The ID of the tag to delete.
 * @param {number} userId - The ID of the user requesting the deletion.
 * @returns {Promise<boolean>} True if the tag was successfully deleted from the 'tags' table.
 */
const deleteTag = async (tagId, userId) => {
  const db = await getDb();

  const tagExists = await db.get('SELECT id FROM tags WHERE id = ?', [tagId]);
  if (!tagExists) {
    throw new AppError('Tag not found.', 404);
  }

  // User-scoping: Permission check - does the user have tasks with this tag?
  const userUsesTag = await db.get(`
    SELECT 1 FROM task_tags tt
    JOIN tasks t ON tt.task_id = t.id
    WHERE tt.tag_id = ? AND t.userId = ?
    LIMIT 1
  `, [tagId, userId]);

  if (!userUsesTag) {
    throw new AppError('You do not have permission to delete this tag as it is not associated with your tasks.', 403);
  }

  // Global Usage Check: Is the tag used by ANY task from ANY user?
  const anyTaskUsingTag = await db.get('SELECT 1 FROM task_tags WHERE tag_id = ? LIMIT 1', [tagId]);

  if (anyTaskUsingTag) {
    throw new AppError('Tag cannot be deleted as it is still associated with one or more tasks.', 400);
  }

  // If no tasks (globally) are using this tag, it's safe to delete from the 'tags' table.
  const result = await db.run('DELETE FROM tags WHERE id = ?', [tagId]);
  if (result.changes === 0) {
    throw new AppError('Tag not found or could not be deleted (it may have been removed by another process).', 404);
  }
  return true;
};

/**
 * Finds tags by prefix for a specific user (for autocomplete).
 * These are tags associated with the user's tasks.
 * @param {string} prefix - The prefix to search for.
 * @param {number} userId - The ID of the user.
 * @param {number} limit - The maximum number of tags to return.
 * @returns {Promise<Array<{id: number, name: string}>>} Matching tags.
 */
const findTagsByPrefix = async (prefix, userId, limit = 10) => {
  const db = await getDb();
  const searchPrefix = prefix.toLowerCase() + '%';
  const tags = await db.all(`
    SELECT DISTINCT t.id, t.name
    FROM tags t
    JOIN task_tags tt ON t.id = tt.tag_id
    JOIN tasks task ON tt.task_id = task.id
    WHERE task.userId = ? AND lower(t.name) LIKE ?
    ORDER BY lower(t.name) ASC
    LIMIT ?
  `, [userId, searchPrefix, limit]);
  return tags;
};

/**
 * Retrieves all unique tags from the database (globally).
 * This might be used for administrative purposes or internal system needs.
 * For user-facing tag lists, getAllTagsForUser should be preferred.
 * @returns {Promise<Array<{id: number, name: string}>>} A promise that resolves to an array of tag objects.
 */
const getAllTags = async () => {
  const db = await getDb();
  const tags = await db.all('SELECT id, name FROM tags ORDER BY lower(name) ASC');
  return tags;
};

/**
 * Clears the tags table for testing purposes.
 * Should only be exposed or used in a test environment.
 */
const __clearTagsTableForTesting = async () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('This function is only for use in a test environment.');
  }
  const db = await getDb();
  await db.run('DELETE FROM tags');
  await db.run("DELETE FROM sqlite_sequence WHERE name='tags';"); // Reset auto-increment
};

module.exports = {
  getAllTagsForUser,
  updateTag,
  deleteTag,
  findTagsByPrefix,
  getAllTags, // Global listing, potentially for admin or specific internal uses
  __clearTagsTableForTesting,
};