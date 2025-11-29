const express = require('express');
const router = express.Router();
const Task = require('./Task');

/**
 * WITHOUT AGGREGATE - Using find(), sort(), skip(), limit()
 *
 * Same features: Search, Filter, Sort, Pagination
 * But using Mongoose query methods instead of aggregation pipeline
 */

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

    // Build query object (same concept - empty object, add conditions)
    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Build sort object
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    let sortObject = { [sortBy]: sortDirection };

    // Problem: Priority sort is tricky without aggregate
    // "high" > "medium" > "low" alphabetically doesn't work!
    // We can't easily do custom sort order with find()

    // Query 1: Get total count (separate query needed!)
    const totalItems = await Task.countDocuments(query);

    // Query 2: Get paginated data
    const tasks = await Task.find(query)
      .sort(sortObject)
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(totalItems / limitNum);

    res.json({
      success: true,
      method: 'WITHOUT AGGREGATE (find + sort + skip + limit)',
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

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    COMPARISON: WITH vs WITHOUT AGGREGATE                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  WITHOUT AGGREGATE (This file)          WITH AGGREGATE (taskRoutes.js)   ║
 * ║  ─────────────────────────────          ─────────────────────────────    ║
 * ║                                                                           ║
 * ║  // 2 separate database queries         // 1 single database query       ║
 * ║                                                                           ║
 * ║  const count = await Task               const result = await Task        ║
 * ║    .countDocuments(query);                .aggregate([                   ║
 * ║                                             { $match },                   ║
 * ║  const tasks = await Task                   { $sort },                    ║
 * ║    .find(query)                             { $facet: {                   ║
 * ║    .sort(sortObject)                          data: [$skip, $limit],     ║
 * ║    .skip(skip)                                totalCount: [$count]        ║
 * ║    .limit(limitNum);                        }}                            ║
 * ║                                           ]);                             ║
 * ║                                                                           ║
 * ║  ❌ 2 DB calls = slower                  ✅ 1 DB call = faster            ║
 * ║  ❌ Can't do custom priority sort        ✅ $addFields for custom sort    ║
 * ║  ❌ Limited transformations              ✅ $project, $group, $lookup     ║
 * ║  ✅ Simple syntax                        ❌ Complex syntax                 ║
 * ║  ✅ Good for basic queries               ✅ Good for complex queries       ║
 * ║                                                                           ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  WHEN TO USE WHAT?                                                        ║
 * ║  ─────────────────                                                        ║
 * ║  find() → Simple CRUD, basic filters, small data                         ║
 * ║  aggregate() → Complex queries, joins, transformations, large data       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */
