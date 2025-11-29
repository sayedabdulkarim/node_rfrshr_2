const express = require('express');
const router = express.Router();
const Task = require('./Task');

// GET /api/tasks - Get tasks with search, filter, sort & pagination
// Query: ?search=keyword&status=pending&priority=high&category=work&sortBy=createdAt&sortOrder=desc&page=1&limit=10
router.get('/', async (req, res) => {
  try {
    const {
      search,
      status,
      priority,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    // Convert to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

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

    // Build sort - 1 = ascending, -1 = descending
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Aggregation pipeline
    const pipeline = [
      { $match: matchCondition }
    ];

    // Special handling for priority sort (low=1, medium=2, high=3)
    if (sortBy === 'priority') {
      pipeline.push({
        $addFields: {
          priorityOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$priority', 'high'] }, then: 3 },
                { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                { case: { $eq: ['$priority', 'low'] }, then: 1 }
              ],
              default: 0
            }
          }
        }
      });
      pipeline.push({ $sort: { priorityOrder: sortDirection } });
    } else {
      pipeline.push({ $sort: { [sortBy]: sortDirection } });
    }

    // Use $facet to get data and count in single query
    pipeline.push({
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limitNum }
        ],
        totalCount: [
          { $count: 'count' }
        ]
      }
    });

    const result = await Task.aggregate(pipeline);

    const tasks = result[0].data;
    const totalItems = result[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limitNum);

    res.json({
      success: true,
      count: tasks.length,
      filters: { search, status, priority, category },
      sort: { sortBy, sortOrder },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
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
