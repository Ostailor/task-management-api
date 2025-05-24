const Joi = require('joi');

const taskSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).allow('').optional(), // Allow empty string, optional
  completed: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).optional(), // Removed .unique()
});

const taskIdSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).allow('').optional(),
  completed: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).optional(), // Removed .unique()
}).min(1); // Requires at least one key to be present for an update

const getTasksQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(), // Max limit 100
  completed: Joi.string().valid('true', 'false').optional(),
  sortBy: Joi.string().regex(/^(createdAt|updatedAt|title|completed)_(ASC|DESC)$/i).optional(),
  tags: Joi.string().trim().min(1).max(200).optional(), // Comma-separated string
  tagMatchMode: Joi.string().trim().valid('all', 'any').optional() // Add tagMatchMode validation
  // search: Joi.string().min(1).max(100).optional(), // If you add search
});

const tagIdSchema = Joi.object({
  id: Joi.number().integer().min(1).required(), // This applies to the 'id' key within req.params
});

const updateTagSchema = Joi.object({
  name: Joi.string().trim().min(1).max(50).required(),
});

const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all errors
      stripUnknown: true, // Remove unknown keys from the validated data
    });

    if (error) {
      // Joi errors automatically have 'isJoi: true' and a 'details' array.
      // No need to manually set error.statusCode here, the errorHandler will set it to 400.
      return next(error); // Pass the Joi error object to the central error handler
    }

    // If validation is successful, update the request property with the validated (and possibly transformed) value.
    req[property] = value; 
    next();
  };
};

module.exports = {
  validateTask: validateRequest(taskSchema),
  validateTaskId: validateRequest(taskIdSchema, 'params'),
  validateUpdateTask: validateRequest(updateTaskSchema),
  validateGetTasksQuery: validateRequest(getTasksQuerySchema, 'query'), // New validator for query params
  validateRequest,
  taskSchema,
  taskIdSchema, // This was for tasks, ensure it's distinct or reuse if identical logic
  updateTaskSchema,
  getTasksQuerySchema,
  tagIdSchema, // Export new schema for tag ID
  updateTagSchema, // Export new schema for tag update body
};