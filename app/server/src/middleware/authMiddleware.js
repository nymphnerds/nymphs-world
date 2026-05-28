import { verifyToken } from '../services/authService.js';

// Auth middleware - extracts user from JWT token
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Support "Bearer <token>" format
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  if (!token) {
    return res.status(401).json({ error: 'Token is required' });
  }
  
  const result = verifyToken(token);
  
  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Attach user info to request
  req.user = {
    username: result.username
  };
  
  next();
}

export default authMiddleware;