const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');

// All routes in this file will be protected
router.use(authenticateToken);

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile management (Authentication Required)
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       404:
 *         description: User profile not found
 *       500:
 *         description: Server error
 */
router.get('/me', userController.getMyProfile);

/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email address for the user. Can be null to remove email.
 *                 example: "new.email@example.com"
 *             example:
 *               email: "new.email@example.com"
 *     responses:
 *       200:
 *         description: User profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid input (e.g., invalid email format, no data provided)
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Email already in use by another account
 *       500:
 *         description: Server error
 */
router.put('/me', userController.updateMyProfile);

/**
 * @swagger
 * /users/me/change-password:
 *   post:
 *     summary: Change current user's password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 description: The user's current password.
 *                 example: "currentPassword123"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: The new password for the user (min 6 characters).
 *                 example: "newStrongPassword456"
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password changed successfully.
 *       400:
 *         description: Invalid input (e.g., incorrect old password, new password too short, new password same as old)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/me/change-password', userController.changeMyPassword);

module.exports = router;