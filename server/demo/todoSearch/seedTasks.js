const mongoose = require('mongoose');
const Task = require('./Task');
const taskData = require('./taskData.json');
require('dotenv').config({ path: '../../.env' });

const seedTasks = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/todo_app');
    console.log('MongoDB Connected...');

    // Clear existing tasks
    await Task.deleteMany({});
    console.log('Cleared existing tasks...');

    // Insert new tasks
    const tasks = await Task.insertMany(taskData);
    console.log(`Inserted ${tasks.length} tasks successfully!`);

    // Show sample data
    console.log('\nSample tasks:');
    tasks.slice(0, 3).forEach(task => {
      console.log(`- ${task.title} | ${task.priority} | ${task.category} | ${task.status}`);
    });

    console.log('\nSeed completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding tasks:', error.message);
    process.exit(1);
  }
};

seedTasks();
