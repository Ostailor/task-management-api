const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { validateTask, validateTaskId, validateUpdateTask, validateGetTasksQuery } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/authMiddleware'); // Import auth middleware

// Apply authentication middleware to all task routes
router.use(authenticateToken);

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: API for managing tasks (Authentication Required)
 */

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Retrieve a list of tasks with pagination, filtering, and sorting
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of tasks per page.
 *       - in: query
 *         name: completed
 *         schema:
 *           type: string
 *           enum:
 *             - 'true'
 *             - 'false'
 *         description: Filter tasks by completion status.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           example: createdAt_DESC
 *         description: Sort tasks by field and order (e.g., title_ASC, completed_DESC). Allowed fields - createdAt, updatedAt, title, completed.
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *           example: "work,urgent"
 *         description: Filter tasks by a comma-separated list of tag names.
 *       - in: query # Add new tagMatchMode parameter
 *         name: tagMatchMode
 *         schema:
 *           type: string
 *           enum: [all, any]
 *           default: all
 *         description: Determines how tasks are filtered by tags. 'all' means tasks must have all specified tags. 'any' means tasks must have at least one of the specified tags.
 *     responses:
 *       200:
 *         description: A list of tasks.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TasksResponse'
 *       400:
 *         description: Invalid query parameters.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', validateGetTasksQuery, taskController.getAllTasks);

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskInput'
 *     responses:
 *       201:
 *         description: The task was successfully created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid input data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error.
 */
router.post('/', validateTask, taskController.createTask);

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get a task by its ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the task to retrieve.
 *     responses:
 *       200:
 *         description: Details of the task.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid ID format.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Task not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error.
 */
router.get('/:id', validateTaskId, taskController.getTaskById);

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update an existing task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the task to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskUpdateInput'
 *     responses:
 *       200:
 *         description: The task was successfully updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid input data or ID format.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Task not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error.
 */
router.put('/:id', validateTaskId, validateUpdateTask, taskController.updateTask);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task by its ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the task to delete.
 *     responses:
 *       204:
 *         description: The task was successfully deleted. No content.
 *       400:
 *         description: Invalid ID format.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Task not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error.
 */
router.delete('/:id', validateTaskId, taskController.deleteTask);

module.exports = router;