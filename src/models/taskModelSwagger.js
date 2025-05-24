/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The user ID.
 *           readOnly: true
 *         username:
 *           type: string
 *           description: The username.
 *         email:
 *           type: string
 *           format: email
 *           description: The user's email address.
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the user was created.
 *           readOnly: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the user was last updated.
 *           readOnly: true
 *       example:
 *         id: 1
 *         username: "testuser"
 *         email: "test@example.com"
 *         createdAt: "2024-05-23T10:30:00.000Z"
 *         updatedAt: "2024-05-23T10:30:00.000Z"
 *     Tag:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "urgent"
 *     Task:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The task ID.
 *           readOnly: true
 *           example: 1
 *         title:
 *           type: string
 *           description: The task title.
 *           example: "Buy groceries"
 *         description:
 *           type: string
 *           description: The task description.
 *           nullable: true
 *           example: "Milk, Eggs, Bread"
 *         completed:
 *           type: boolean
 *           description: Whether the task is completed or not.
 *           example: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the task was created.
 *           readOnly: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the task was last updated.
 *           readOnly: true
 *         userId:
 *           type: integer
 *           description: The ID of the user who owns the task.
 *           example: 1
 *         tags:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Tag'
 *           description: Tags associated with the task.
 *           example: [{ "id": 1, "name": "home" }, { "id": 2, "name": "shopping" }]
 *     TaskInput:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         title:
 *           type: string
 *           description: The task title.
 *           example: "Schedule meeting"
 *         description:
 *           type: string
 *           description: The task description.
 *           nullable: true
 *           example: "Team meeting for project alpha"
 *         completed:
 *           type: boolean
 *           description: Whether the task is completed or not. Defaults to false.
 *           example: false
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *             example: "work"
 *           description: An array of tag names to associate with the task.
 *           example: ["project-alpha", "meeting"]
 *     TaskUpdateInput:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: The new title of the task.
 *           example: "Updated: Schedule meeting"
 *         description:
 *           type: string
 *           description: The new detailed description of the task.
 *           nullable: true
 *           example: "Updated: Team meeting with stakeholders"
 *         completed:
 *           type: boolean
 *           description: The new completion status of the task.
 *           example: true
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *             example: "work"
 *           description: An array of tag names. Replaces all existing tags for the task. If an empty array is provided, all tags will be removed.
 *           example: ["project-alpha", "urgent"]
 *     TasksResponse:
 *       type: object
 *       properties:
 *         tasks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Task'
 *         total:
 *           type: integer
 *           example: 10
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 10
 *         totalPages:
 *           type: integer
 *           example: 1
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Error message description"
 *         errors:
 *           type: array
 *           items:
 *             type: string
 *           example: ["'title' is required"]
 */