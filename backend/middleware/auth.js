const jwt = require('jsonwebtoken');

// ─── Middleware: Require Auth (Any logged-in user) ──────────────────────────
exports.requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_dev_only');
    req.user = decoded; // { id, role, username }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed.' });
  }
};

// ─── Middleware: Require SuperAdmin ───────────────────────────────────────────
exports.requireSuperAdmin = (req, res, next) => {
  // Must be called AFTER requireAuth
  if (req.user && req.user.role === 'SuperAdmin') {
    next();
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Forbidden. SuperAdmin access required.' 
    });
  }
};
