const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const sessionRoutes = require("./sessionRoutes");

const app = express();

// CORS — allow frontend
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true, // important for cookies
  })
);

app.use(express.json());

// SESSION setup
app.use(
  session({
    secret: "my-secret-key", // cookie encrypt karne ke liye
    resave: false, // agar session change nahi hua toh dubara save mat karo
    saveUninitialized: false, // bina login ke empty session mat banao
    cookie: {
      maxAge: 1000 * 60 * 5, // 5 minutes mein expire
      httpOnly: true, // JS se cookie access nahi hoga (security)
    },
  })
);

// Routes
app.use("/api/session", sessionRoutes);

// Start
const PORT = 5050;
app.listen(PORT, () => {
  console.log(`Session Demo Server running on http://localhost:${PORT}`);
  console.log(`\nTest users:`);
  console.log(`  Premium: sayed@test.com / 123456`);
  console.log(`  Free:    test@test.com / 123456`);
});
