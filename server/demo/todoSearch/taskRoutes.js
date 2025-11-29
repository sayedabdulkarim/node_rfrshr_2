const express = require('express');
const router = express.Router();
const Task = require('./Task');

// GET /api/tasks - Get tasks with search & filter
// Query: ?search=keyword&status=pending&priority=high&category=work
router.get('/', async (req, res) => {
  try {
    const { search, status, priority, category } = req.query;

    // Build match condition
    let matchCondition = {};

    // Search filter (OR condition - match any field)
    if (search) {
      matchCondition.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      matchCondition.status = status;
    }

    // Priority filter
    if (priority) {
      matchCondition.priority = priority;
    }

    // Category filter
    if (category) {
      matchCondition.category = category;
    }

    // Aggregation pipeline
    const tasks = await Task.aggregate([
      { $match: matchCondition },
      { $sort: { createdAt: -1 } }
    ]);

    res.json({
      success: true,
      count: tasks.length,
      filters: { search, status, priority, category },
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
