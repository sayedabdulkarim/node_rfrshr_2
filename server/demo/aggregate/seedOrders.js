const mongoose = require("mongoose");
const Order = require("./models/Order");
const Product = require("./models/Product");
const productsData = require("./productsData.json");
const ordersData = require("./ordersData.json");
require("dotenv").config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected...\n");

    // Clear existing data
    await Order.deleteMany({});
    await Product.deleteMany({});
    console.log("Old orders & products deleted\n");

    // Insert products first
    const products = await Product.insertMany(
      productsData.map((p) => ({
        name: p.name,
        price: p.price,
        category: p.category,
      }))
    );
    console.log(`${products.length} products inserted!`);

    // Create productId mapping (prod001 -> actual ObjectId)
    const productMap = {};
    productsData.forEach((p, index) => {
      productMap[p._id] = products[index]._id;
    });

    // Insert orders with actual ObjectIds
    const orders = ordersData.map((order) => ({
      userId: new mongoose.Types.ObjectId(order.userId),
      productId: productMap[order.productId],
      amount: order.amount,
      status: order.status,
    }));

    await Order.insertMany(orders);
    console.log(`${orders.length} orders inserted!\n`);

    // Show products
    console.log("--- Products ---");
    products.forEach((p) => {
      console.log(`${p.name} - ₹${p.price} [${p.category}]`);
    });

    console.log("\n--- Orders ---");
    const allOrders = await Order.find().populate("productId", "name");
    allOrders.forEach((o) => {
      console.log(`${o.productId?.name} - ₹${o.amount} [${o.status}]`);
    });

    console.log("\nDone! Ab $lookup query chala sakte ho.");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
};

seedData();
