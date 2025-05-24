const userService = require('../services/userService');
const Joi = require('joi'); // For validation

exports.getMyProfile = async (req, res, next) => {
  try {
    // req.user is attached by authenticateToken middleware and contains { id, username }
    const userProfile = await userService.getUserById(req.user.id);
    if (!userProfile) {
      // This case should ideally not happen if token is valid and user exists
      return res.status(404).json({ message: 'User profile not found.' });
    }
    res.status(200).json(userProfile);
  } catch (error) {
    next(error);
  }
};

// Validation schema for profile update
const updateProfileSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).allow(null).optional(), // Allow email to be explicitly set to null or be a valid email
  // Add other updatable fields here if needed in the future
}).min(1); // Require at least one field to be updated

exports.updateMyProfile = async (req, res, next) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: 'Validation error', errors: error.details.map(d => d.message) });
    }

    if (Object.keys(value).length === 0) {
        return res.status(400).json({ message: 'No update data provided.' });
    }

    const updatedUser = await userService.updateUserProfile(req.user.id, value);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

// Validation schema for password change
const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required().invalid(Joi.ref('oldPassword')), // Ensure new is different and min length
}).messages({
    'any.invalid': 'New password must be different from the old password.'
});

exports.changeMyPassword = async (req, res, next) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: 'Validation error', errors: error.details.map(d => d.message) });
    }

    const { oldPassword, newPassword } = value;
    const result = await userService.changePassword(req.user.id, oldPassword, newPassword);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};