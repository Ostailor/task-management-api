const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { 
    getAllTags, 
    updateTag, 
    deleteTag,
    autocompleteTags
} = require('../controllers/tagController');
const { validateRequest } = require('../middleware/validation');
const { tagIdSchema, updateTagSchema } = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     TagInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *           description: The name of the tag.
 *           example: "Project Alpha"
 *   requestBodies:
 *     TagBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TagInput'
 */

/**
 * @swagger
 * tags:
 *   name: Tags
 *   description: API for managing tags
 */

/**
 * @swagger
 * /tags:
 *   get:
 *     summary: Retrieve a list of all available tags
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: [] # Assuming listing tags also requires authentication
 *     responses:
 *       200:
 *         description: A list of tags.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag' # Reference the Tag schema from taskModelSwagger.js
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/', getAllTags);

/**
 * @swagger
 * /tags/autocomplete:
 *   get:
 *     summary: Autocomplete tags based on a query
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: The query string to autocomplete tags.
 *     responses:
 *       200:
 *         description: A list of matching tags.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Tag'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/autocomplete', autocompleteTags);

/**
 * @swagger
 * /tags/{id}:
 *   put:
 *     summary: Update an existing tag's name
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the tag to update.
 *     requestBody:
 *       $ref: '#/components/requestBodies/TagBody'
 *     responses:
 *       200:
 *         description: Tag updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tag'
 *       400:
 *         description: Invalid input (e.g., missing name, invalid ID format, name too long).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Tag not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflict - A tag with the new name already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:id', validateRequest(tagIdSchema, 'params'), validateRequest(updateTagSchema, 'body'), updateTag);

/**
 * @swagger
 * /tags/{id}:
 *   delete:
 *     summary: Delete a tag by ID
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the tag to delete.
 *     responses:
 *       200:
 *         description: Tag deleted successfully.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Tag not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:id', validateRequest(tagIdSchema, 'params'), deleteTag);

module.exports = router;