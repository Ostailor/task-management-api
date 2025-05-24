const userService = require('../services/userService');

exports.register = async (req, res, next) => {
  try {
    const { username, password, email } = req.body; // Add email
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    if (password.length < 6) {
         return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    // Optional: Add Joi validation for email format if provided
    // if (email && !isValidEmailFormat(email)) { // isValidEmailFormat would be a helper or Joi
    //    return res.status(400).json({ message: 'Invalid email format' });
    // }

    const user = await userService.registerUser({ username, password, email }); // Pass email
    // userService.registerUser already returns user without password
    res.status(201).json({ message: 'User registered successfully', user: user });
  } catch (error) {
    next(error); // Pass to global error handler
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const result = await userService.loginUser({ username, password });
    res.status(200).json({ message: 'Login successful', ...result });
  } catch (error) {
    next(error);
  }
};