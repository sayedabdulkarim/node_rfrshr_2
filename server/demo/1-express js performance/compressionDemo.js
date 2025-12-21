const express = require("express");
const compression = require("compression");

const app = express();

// Sample large JSON data (simulate real API response)
const largeData = {
  users: Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    address: `123 Street, City ${i + 1}, Country`,
    bio: `This is a long biography text for user ${
      i + 1
    }. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
  })),
};

// ❌ WITHOUT Compression - Normal response
app.get("/no-compression", (req, res) => {
  res.json(largeData);
});

// ✅ WITH Compression - Compressed response
app.get("/with-compression", compression(), (req, res) => {
  res.json(largeData);
});

app.get("/", (req, res) => {
  res.send(`
    <h2>Compression Demo</h2>
    <p>Open DevTools → Network tab → Compare response sizes:</p>
    <ul>
      <li><a href="/no-compression">/no-compression</a> - Without gzip</li>
      <li><a href="/with-compression">/with-compression</a> - With gzip</li>
    </ul>
    <p>Or run in terminal:</p>
    <pre>
curl -s -o /dev/null -w "Size: %{size_download} bytes\\n" http://localhost:4000/no-compression
curl -s -o /dev/null -w "Size: %{size_download} bytes\\n" -H "Accept-Encoding: gzip" http://localhost:4000/with-compression
    </pre>
  `);
});

app.listen(4000, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  Compression Demo running on port 4000        ║
║                                               ║
║  Test endpoints:                              ║
║  → http://localhost:4000/no-compression       ║
║  → http://localhost:4000/with-compression     ║
║                                               ║
║  Check Network tab in DevTools to see size!   ║
╚═══════════════════════════════════════════════╝
  `);
});
