// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const userAuth = (req, res, next) => {
  try {
    console.log(req)
    // Try to get token from cookie first, then fall back to Authorization header
    let token = req.cookies.accessToken;
    
    // Fallback: check Authorization header
    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
    }
    
    if (!token) {
      return res.status(401).json({ 
        message: 'No token, authorization denied',
        error: 'Unauthorized' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        error: 'TokenExpired' 
      });
    }
    
    res.status(401).json({ 
      message: 'Token is not valid',
      error: 'InvalidToken' 
    });
  }
};

module.exports = userAuth;