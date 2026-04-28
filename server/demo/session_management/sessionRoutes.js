const express = require("express");
const router = express.Router();

// Fake users (no DB needed)
const users = [
  { id: 1, email: "sayed@test.com", password: "123456", name: "Sayed", plan: "premium" },
  { id: 2, email: "test@test.com", password: "123456", name: "Test User", plan: "free" },
];

// LOGIN — session create
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // SET session
  req.session.user = { id: user.id, name: user.name, plan: user.plan };

  res.json({ message: `Welcome ${user.name}!`, user: req.session.user });
});

// GET profile — check session
router.get("/profile", (req, res) => {
  // GET session
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in. Please login first." });
  }

  res.json({ message: "You are logged in", user: req.session.user });
});

// PREMIUM content — authorization check
router.get("/premium-content", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" });
  }

  if (req.session.user.plan !== "premium") {
    return res.status(403).json({ error: "You need premium plan to access this content" });
  }

  res.json({
    message: "Welcome to premium content!",
    content: "This is the secret premium video 🔥",
  });
});

// LOGOUT — session destroy
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

module.exports = router;
