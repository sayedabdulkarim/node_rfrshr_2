const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");
const { protect } = require("../middleware/auth");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Get default 'user' role
    const defaultRole = await Role.findOne({ name: 'user' });

    // Create user with default role
    const user = await User.create({
      name,
      email,
      password,
      roles: defaultRole ? [defaultRole._id] : []
    });

    if (user) {
      // Populate roles for response
      await user.populate('roles', 'name permissions');

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user with roles populated
    const user = await User.findOne({ email })
      .select("+password")
      .populate('roles', 'name permissions');

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user._id).populate('roles', 'name permissions');
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    roles: user.roles,
  });
});

module.exports = router;
