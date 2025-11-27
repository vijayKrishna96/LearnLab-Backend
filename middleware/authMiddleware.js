const jwt = require('jsonwebtoken');
const { User } = require('../models/userModel');

const authMiddleware = async (req, res, next) => {
  try {
    // Extract the token from cookies
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the user to the request object (using the decoded userId from the token)
    const user = await User.findById(decoded.id); // Assuming the token has userId in payload
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Attach the user to the request object
    req.user = user;

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};


module.exports = authMiddleware;
