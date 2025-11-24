const express = require("express");
const app = express();

// ========== 1. Cache-Control ==========
// Browser ko bolo: "60 sec tak cache rakh, server ko mat puch"

app.get("/products", (req, res) => {
  res.set("Cache-Control", "public, max-age=60"); // 60 sec cache
  res.json({ products: ["iPhone", "Samsung"] });
});

// ========== 2. ETag ==========
// Browser ko bolo: "data same hai toh dobara mat bhej"

app.get("/user", (req, res) => {
  const user = { id: 1, name: "John" };
  const etag = "abc123"; // normally hash hota hai data ka

  // Browser ne purana etag bheja?
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).send(); // "Data same hai, apna cached use kar"
  }

  res.set("ETag", etag);
  res.json(user);
});

app.listen(3001, () => console.log("Server running on 3001"));
