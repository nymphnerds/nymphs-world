// Admin check middleware - must be used after authMiddleware
// For now: any authenticated user is considered admin
// Future: check req.user.role === 'admin'
function requireAdmin(req, res, next) {
  if (req.user) {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
}

export default requireAdmin;