const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// GET /api/orders/user-order-count
// Har user ke kitne orders - using $group
router.get("/user-order-count", async (req, res) => {
  try {
    const result = await Order.aggregate([
      {
        $group: {
          _id: "$userId",
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    res.json({
      message: "Har user ke kitne orders",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/orders/user-order-count
// Har user ka total spend - using $group
router.get("/user-order-spend", async (req, res) => {
  try {
    const result = await Order.aggregate([
      {
        $group: {
          _id: "$userId",
          totalAmountSpent: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      message: "Har user ka total spend",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/orders/user-orders-products
// Interview Question: User + Orders + Products in single query using $lookup
router.get("/user-orders-products", async (req, res) => {
  try {
    const result = await Order.aggregate([
      // Step 1: Orders ke saath User details join karo
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      // Step 2: Orders ke saath Product details join karo
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      // Step 3: Arrays ko objects mein convert karo (first element)
      {
        $unwind: "$userDetails",
      },
      {
        $unwind: "$productDetails",
      },
      // Step 4: Clean response - sirf required fields
      {
        $project: {
          _id: 1,
          amount: 1,
          status: 1,
          user: {
            name: "$userDetails.name",
            email: "$userDetails.email",
          },
          product: {
            name: "$productDetails.name",
            price: "$productDetails.price",
            category: "$productDetails.category",
          },
        },
      },
    ]);

    res.json({
      message: "User + Orders + Products (Interview Question)",
      total: result.length,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
