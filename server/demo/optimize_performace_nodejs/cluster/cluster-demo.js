const cluster = require("cluster");
const os = require("os");

const numCPUs = os.cpus().length; // kitne cores hain

if (cluster.isMaster) {
  console.log(`Master process: ${process.pid}`);
  console.log(`Total CPUs: ${numCPUs}`);

  // Har core ke liye ek worker banao
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  // Worker process - yahan app chalao
  console.log(`Worker started: ${process.pid}`);

  // require("./server.js"); // actual app yahan
}

//
// ok, to mera backend code hai , or usi ka multi copies ban gye ? aisa ?

// ⏺ Haan bilkul sahi!

//   Tera backend code: server.js

//   Bina Clustering:
//   → server.js (1 copy chal rahi)

//   With Clustering:
//   → server.js (copy 1) - CPU 1 pe
//   → server.js (copy 2) - CPU 2 pe
//   → server.js (copy 3) - CPU 3 pe
//   ... 12 copies chal rahi

//   ---
//   Sab same port pe sunte hain (3000):

//   Request aaya port 3000 pe
//           ↓
//   OS decide karega: "Kaun sa worker free hai? Usko de do"
//           ↓
//   Worker 3 free hai → Request Worker 3 ko gayi

//   ---
//   Tera code same hai, bas multiple instances chal rahi hain.

//   Jaise McDonald's mein same burger recipe, but 5 counters khule hain - zyada customers handle ho jayenge.
