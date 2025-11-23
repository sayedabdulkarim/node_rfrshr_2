const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['user', 'admin', 'superadmin', 'support', 'merchant']
  },
  permissions: [{
    type: String,
    enum: [
      'read',
      'write',
      'delete',
      'manage_users',
      'view_reports',
      'manage_orders',
      'manage_roles'
    ]
  }],
  description: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
