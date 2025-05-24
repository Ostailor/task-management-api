const jwt = require('jsonwebtoken');
const userService = require('../services/userService'); // To potentially fetch full user object

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']; // Check this header name
  const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1];

  if (token == null) {
    // This is the error you're getting
    return res.status(401).json({ message: 'Unauthorized: No token provided' }); // No token
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Optionally fetch the full user from DB to ensure they still exist/are active
    // const user = await userService.getUserById(decoded.id);
    // if (!user) {
    //   return res.status(403).json({ message: 'Forbidden: User not found' });
    // }
    // req.user = user; // Attach full user object
    req.user = decoded; // Attach decoded payload (id, username) to request object
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Unauthorized: Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
    // For other errors during verification
    console.error("Token verification error:", err);
    return res.status(403).json({ message: 'Forbidden: Token verification failed' });
  }
};

module.exports = { authenticateToken };