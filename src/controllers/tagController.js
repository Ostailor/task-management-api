const tagService = require('../services/tagService');
const { AppError } = require('../utils/AppError');

/**
 * Handles the request to get all tags.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
const getAllTags = async (req, res, next) => { 
    try {
        // This should fetch tags specific to the logged-in user
        const tags = await tagService.getAllTagsForUser(req.user.id); // Corrected
        res.json(tags);
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the request to update a tag's name.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
const updateTag = async (req, res, next) => {
    try {
        const tagId = parseInt(req.params.id, 10);
        const { name: newName } = req.body; // newName is already validated by middleware

        // The service will handle if tagId is for a non-existent tag or if newName conflicts
        const updatedTag = await tagService.updateTag(tagId, newName, req.user.id); // Pass userId
        // AppError will be thrown by service for 404, 409, 400 etc.
        res.json(updatedTag);
    } catch (error) {
        next(error); // Let the central error handler manage it
    }
};

/**
 * Handles the request to delete a tag.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
const deleteTag = async (req, res, next) => {
    try {
        const tagId = parseInt(req.params.id, 10); // Validated by middleware

        await tagService.deleteTag(tagId, req.user.id); // Pass userId
        // Service will throw AppError if deletion is not allowed (e.g., tag in use, not found)
        res.status(204).send(); 
    } catch (error) {
        next(error);
    }
};

/**
 * Handles the request to autocomplete tags.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
const autocompleteTags = async (req, res, next) => {
    try {
        const query = req.query.q || '';
        const showAll = req.query.showAll === 'true';
        const limit = parseInt(req.query.limit, 10) || 10; // Default limit

        if (query.length < 1 && !showAll) { 
            return res.json([]);
        }

        let tags;
        if (showAll && query.length < 1) {
            // If showAll is true and query is empty, get all tags for the user
            // Note: getAllTagsForUser doesn't currently accept a limit.
            // If a limit is desired here, getAllTagsForUser would need modification
            // or apply limit after fetching. For now, let's assume it returns all.
            tags = await tagService.getAllTagsForUser(req.user.id);
        } else {
            // Otherwise, find by prefix (respecting limit)
            tags = await tagService.findTagsByPrefix(query, req.user.id, limit);
        }
        
        res.json(tags);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllTags,
    updateTag,
    deleteTag,
    autocompleteTags
};