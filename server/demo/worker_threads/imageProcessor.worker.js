const { parentPort, workerData } = require('worker_threads');
const sharp = require('sharp');
const fs = require('fs');

/**
 * IMAGE PROCESSING WORKER
 * This worker runs in a separate thread to process images
 * Main thread stays responsive while this does CPU-intensive work
 */

console.log('🧵 Worker Thread started for image processing...');

const { inputPath, outputPath, width, height } = workerData;

// Start processing
const startTime = Date.now();

// ============================================
// HEAVY CPU TASK - To demonstrate blocking
// Simulate real image processing load
// ============================================
console.log('🧵 Adding CPU-intensive work to simulate heavy processing...');

// Heavy computation loop (simulates complex image processing)
let dummySum = 0;
for (let i = 0; i < 2000000000; i++) {  // 2 billion iterations
  dummySum += Math.sqrt(i);
}
console.log('🧵 Heavy computation completed');

// Now actual image resize
sharp(inputPath)
  .resize(width || 800, height || 600, {
    fit: 'inside',
    withoutEnlargement: true
  })
  .toFile(outputPath)
  .then((info) => {
    const processingTime = Date.now() - startTime;

    console.log(`🧵 Worker completed in ${processingTime}ms`);
    console.log(`   Original: ${(fs.statSync(inputPath).size / 1024).toFixed(2)} KB`);
    console.log(`   Resized: ${(info.size / 1024).toFixed(2)} KB`);

    // Send result back to main thread
    parentPort.postMessage({
      success: true,
      processingTime,
      originalSize: fs.statSync(inputPath).size,
      newSize: info.size,
      dimensions: {
        width: info.width,
        height: info.height
      }
    });
  })
  .catch((error) => {
    console.error('🧵 Worker error:', error);
    parentPort.postMessage({
      success: false,
      error: error.message
    });
  });
