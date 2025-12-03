require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const todoRoutes = require('./routes/todoRoutes');
const testPasswordRoute = require('./routes/testPasswordRoute');
const fileRoutes = require('./routes/fileRoutes');
const profileRoutes = require('./routes/profileRoutes');
const orderRoutes = require('./routes/orderRoutes');
const taskRoutes = require('./demo/todoSearch/taskRoutes');
const taskRoutesNoAgg = require('./demo/todoSearch/taskRoutesWithoutAggregate');

const app = express();

// Connect to MongoDB
connectDB();

// ============ MIDDLEWARES ============

// Configure CORS with options
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-JSON'],
  maxAge: 86400
};

app.use(cors(corsOptions));

// Body parser middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logger
app.use(morgan('dev'));

// ============ ROUTES ============

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: 'Todo API Server',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me (Protected)'
      },
      todos: {
        getAll: 'GET /api/todos (Protected)',
        create: 'POST /api/todos (Protected)',
        update: 'PUT /api/todos/:id (Protected)',
        delete: 'DELETE /api/todos/:id (Protected)',
        toggle: 'PUT /api/todos/:id/toggle (Protected)'
      }
    }
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Todo routes (all protected)
app.use('/api/todos', todoRoutes);

// Test routes for learning
app.use('/api/test', testPasswordRoute);

// File handling routes (Buffer vs Stream demo)
app.use('/api/files', fileRoutes);

// Profile routes (Profile picture upload - Buffer vs Stream)
app.use('/api/profile', profileRoutes);

// Order routes (Aggregation practice)
app.use('/api/orders', orderRoutes);

// Task routes (Search, Filter, Sort, Pagination demo)
app.use('/api/tasks', taskRoutes);

// ============ ERROR HANDLING MIDDLEWARE ============

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: errors.join(', ') });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ error: `${field} already exists` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Server error'
  });
});

// ============ PROCESS LEVEL ERROR HANDLERS ============

// Unhandled Promise Rejection
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// Uncaught Exception
process.on('uncaughtException', (error) => {
  console.error('💀 Uncaught Exception:', error);
  process.exit(1);
});

// Warnings
process.on('warning', (warning) => {
  console.warn('⚠️ Warning:', warning.name, warning.message);
});

// ============ START SERVER ============

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║                                        ║
║   🚀 Server running on port ${PORT}       ║
║   📦 MongoDB Connected                 ║
║   🔐 Auth & Todo APIs Ready            ║
║                                        ║
║   Test with:                          ║
║   http://localhost:${PORT}              ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});