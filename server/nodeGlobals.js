// =============================================
// Node.js Global Objects - Practical Examples
// =============================================

console.log("=== NODE.JS GLOBALS DEMO ===\n");

// -----------------------
// 1. CONSOLE (logging)
// -----------------------
console.log("1. CONSOLE GLOBAL");
console.log("Regular log message");
console.error("Error message (goes to stderr)");
console.warn("Warning message");
console.table([{ name: "Ali", age: 25 }, { name: "Sara", age: 30 }]);
console.time("timer");
for (let i = 0; i < 1000000; i++) {} // some work
console.timeEnd("timer");
console.log();

// -----------------------
// 2. __dirname & __filename (CommonJS only)
// -----------------------
console.log("2. __dirname & __filename");
console.log("Current directory:", __dirname);
console.log("Current file:", __filename);
console.log();

// -----------------------
// 3. PROCESS
// -----------------------
console.log("3. PROCESS GLOBAL");
console.log("Node version:", process.version);
console.log("Platform:", process.platform);
console.log("Architecture:", process.arch);
console.log("Current working directory:", process.cwd());
console.log("Process ID:", process.pid);
console.log("Memory usage:", process.memoryUsage().heapUsed / 1024 / 1024, "MB");
console.log("Uptime:", process.uptime(), "seconds");
// process.env contains environment variables
console.log("NODE_ENV:", process.env.NODE_ENV || "not set");
console.log();

// -----------------------
// 4. BUFFER (binary data)
// -----------------------
console.log("4. BUFFER GLOBAL");
const buf1 = Buffer.from("Hello Node.js");
console.log("Buffer from string:", buf1);
console.log("Buffer to string:", buf1.toString());
console.log("Buffer length:", buf1.length, "bytes");
const buf2 = Buffer.alloc(10); // allocate 10 bytes (filled with zeros)
console.log("Allocated buffer:", buf2);
console.log();

// -----------------------
// 5. GLOBAL object
// -----------------------
console.log("5. GLOBAL OBJECT");
global.myGlobalVar = "I am accessible everywhere!";
console.log("Custom global variable:", global.myGlobalVar);
console.log("Is console on global?", global.console === console);
console.log("Is process on global?", global.process === process);
console.log();

// -----------------------
// 6. TIMERS
// -----------------------
console.log("6. TIMERS");

// setTimeout - runs once after delay
setTimeout(() => {
  console.log("  setTimeout: Executed after 1 second");
}, 1000);

// setImmediate - runs after I/O events in current iteration
setImmediate(() => {
  console.log("  setImmediate: Executed immediately after I/O");
});

// setInterval - runs repeatedly
let count = 0;
const intervalId = setInterval(() => {
  count++;
  console.log(`  setInterval: Run #${count}`);
  if (count >= 3) {
    clearInterval(intervalId); // stop after 3 runs
    console.log("  setInterval: Cleared!\n");

    // Continue with remaining demos after interval completes
    runRemainingDemos();
  }
}, 500);

// -----------------------
// 7. MODULE system (CommonJS)
// -----------------------
console.log("\n7. MODULE SYSTEM (CommonJS)");
console.log("module.filename:", module.filename);
console.log("module.id:", module.id);
console.log("module.loaded:", module.loaded);
console.log("exports === module.exports:", exports === module.exports);
console.log();

function runRemainingDemos() {
  // -----------------------
  // 8. URL & URLSearchParams
  // -----------------------
  console.log("8. URL & URLSearchParams");
  const myUrl = new URL("https://example.com/path?name=ali&age=25");
  console.log("Full URL:", myUrl.href);
  console.log("Host:", myUrl.host);
  console.log("Pathname:", myUrl.pathname);
  console.log("Search params - name:", myUrl.searchParams.get("name"));

  const params = new URLSearchParams({ city: "Karachi", country: "Pakistan" });
  console.log("URLSearchParams:", params.toString());
  console.log();

  // -----------------------
  // 9. TextEncoder & TextDecoder
  // -----------------------
  console.log("9. TextEncoder & TextDecoder");
  const encoder = new TextEncoder();
  const encoded = encoder.encode("Hello!");
  console.log("Encoded:", encoded);

  const decoder = new TextDecoder();
  const decoded = decoder.decode(encoded);
  console.log("Decoded:", decoded);
  console.log();

  // -----------------------
  // 10. queueMicrotask
  // -----------------------
  console.log("10. queueMicrotask");
  queueMicrotask(() => {
    console.log("  Microtask executed (runs before next tick)");
  });
  console.log("  This logs before microtask");
  console.log();

  // -----------------------
  // 11. structuredClone (deep copy)
  // -----------------------
  console.log("11. structuredClone");
  const original = { name: "Ali", nested: { city: "Lahore" } };
  const clone = structuredClone(original);
  clone.nested.city = "Karachi";
  console.log("Original:", original.nested.city); // still "Lahore"
  console.log("Clone:", clone.nested.city); // "Karachi"
  console.log();

  // -----------------------
  // 12. AbortController
  // -----------------------
  console.log("12. AbortController");
  const controller = new AbortController();
  console.log("Signal aborted?", controller.signal.aborted);
  controller.abort();
  console.log("Signal aborted after abort()?", controller.signal.aborted);
  console.log();

  // -----------------------
  // 13. Performance
  // -----------------------
  console.log("13. Performance");
  const start = performance.now();
  for (let i = 0; i < 1000000; i++) {} // some work
  const end = performance.now();
  console.log(`Operation took ${(end - start).toFixed(2)} milliseconds`);
  console.log();

  // -----------------------
  // 14. crypto (Web Crypto API)
  // -----------------------
  console.log("14. crypto (Web Crypto API)");
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  console.log("Random bytes:", randomBytes);
  console.log("Random UUID:", crypto.randomUUID());
  console.log();

  console.log("=== DEMO COMPLETE ===");
}
