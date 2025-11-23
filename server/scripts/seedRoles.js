const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Role = require('../models/Role');

const roles = [
  {
    name: 'user',
    permissions: ['read'],
    description: 'Normal user - can only read their own data'
  },
  {
    name: 'admin',
    permissions: ['read', 'write', 'delete'],
    description: 'Admin - can manage content'
  },
  {
    name: 'superadmin',
    permissions: ['read', 'write', 'delete', 'manage_users', 'manage_roles'],
    description: 'Super Admin - full access'
  },
  {
    name: 'support',
    permissions: ['read', 'view_reports'],
    description: 'Customer Support - can view and help users'
  },
  {
    name: 'merchant',
    permissions: ['read', 'write', 'manage_orders'],
    description: 'Merchant - can manage their products and orders'
  }
];

const seedRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    // Clear existing roles
    await Role.deleteMany({});
    console.log('Existing roles cleared');

    // Insert new roles
    const createdRoles = await Role.insertMany(roles);
    console.log('Roles seeded successfully:');
    createdRoles.forEach(role => {
      console.log(`  - ${role.name}: ${role.permissions.join(', ')}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  }
};

seedRoles();
