// 1- Avoid blocking the event loop with synchronous operations

const fs = require("fs");

// ========== BAD: Sync (Blocking) ==========
// console.log("1 - Start");
// const data = fs.readFileSync("node.md"); // YAHAN RUKA
// console.log("2 - File mili");
// console.log("3 - End");

// Output: 1 -> 2 -> 3 (sab ek k baad ek, ruk k)

// ========== GOOD: Async (Non-Blocking) ==========
// console.log("\n--- ASYNC ---");
// console.log("A - Start");
// fs.readFile("node.md", () => {
//   console.log("B - File mili");
// });
// console.log("C - End");
// Dekh B last mein aayega!

// 2 - Use `setImmediate()` or `process.nextTick()` to break up CPU-intensive tasks

// ========== BAD: Heavy loop blocks everything ==========
// console.log("1 - Start");

// setTimeout(() => console.log("2 - Timer"), 0); // ye wait karega

// for (let i = 0; i < 1000000000; i++) {} // BLOCKING loop

// console.log("3 - End");

// ========== GOOD: setImmediate() se loop todo ==========
// Total kaam: 10 items
// Chunk size: 3 items at a time

let count = 0;

function chunkedLoop() {
  console.log(`\n--- Chunk start (count: ${count}) ---`);

  // 3 items process karo
  for (let i = 0; i < 3 && count < 10; i++, count++) {
    console.log(`Processing item ${count}`);
  }

  if (count < 10) {
    console.log("Break le raha... (setImmediate)");
    setImmediate(chunkedLoop);
  } else {
    console.log("\nSab done!");
  }
}

chunkedLoop();
