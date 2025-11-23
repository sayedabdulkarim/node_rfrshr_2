const User = require('../models/User');

// Middleware to check if user has required permission
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).populate('roles', 'permissions');

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Check if any of user's roles have the required permission
      const hasPermission = user.roles.some(role =>
        role.permissions.includes(requiredPermission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Access denied. You do not have permission to perform this action.'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Server error during permission check' });
    }
  };
};

// Middleware to check if user has specific role
const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).populate('roles', 'name');

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Check if user has any of the allowed roles
      const hasRole = user.roles.some(role =>
        allowedRoles.includes(role.name)
      );

      if (!hasRole) {
        return res.status(403).json({
          error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Server error during role check' });
    }
  };
};

module.exports = { checkPermission, checkRole };
