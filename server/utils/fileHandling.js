// ============================================
// FILE HANDLING UTILITY - BUFFER vs STREAM
// ============================================

const fs = require('fs');
const path = require('path');

// ============================================
// APPROACH 1: BUFFER (For small files)
// ============================================

/**
 * Read file using BUFFER
 * - Pura file memory mein load hota hai
 * - Fast access
 * - Small files ke liye best (images, small PDFs)
 */
function readFileWithBuffer(filePath) {
  console.log('📦 Reading with BUFFER...');

  // Pura file ek baar mein memory mein aa gaya
  const buffer = fs.readFileSync(filePath);

  console.log(`✓ File size: ${buffer.length} bytes`);
  console.log(`✓ Type: ${typeof buffer}`); // Buffer object
  console.log(`✓ Memory mein pura file loaded hai!`);

  return buffer;
}

/**
 * Write file using BUFFER
 */
function writeFileWithBuffer(filePath, data) {
  console.log('📦 Writing with BUFFER...');

  // Convert string to buffer if needed
  const buffer = Buffer.from(data);

  // Ek baar mein pura write
  fs.writeFileSync(filePath, buffer);

  console.log('✓ File written successfully!');
}

// ============================================
// APPROACH 2: STREAM (For large files)
// ============================================

/**
 * Read file using STREAM
 * - File chunks (टुकड़ों) mein read hota hai
 * - Memory efficient
 * - Large files ke liye best (videos, large logs)
 */
function readFileWithStream(filePath) {
  console.log('🌊 Reading with STREAM...');

  return new Promise((resolve, reject) => {
    // Create readable stream
    const readStream = fs.createReadStream(filePath, {
      highWaterMark: 1024 // 1KB chunks (default: 64KB)
    });

    let chunks = [];
    let chunkCount = 0;

    // Data event - har chunk ke liye trigger hota hai
    readStream.on('data', (chunk) => {
      chunkCount++;
      console.log(`  → Chunk ${chunkCount} received: ${chunk.length} bytes`);
      chunks.push(chunk);
    });

    // End event - jab saara file read ho jaye
    readStream.on('end', () => {
      const completeData = Buffer.concat(chunks);
      console.log(`✓ Total chunks: ${chunkCount}`);
      console.log(`✓ Total size: ${completeData.length} bytes`);
      console.log('✓ File read complete (chunk by chunk)!');
      resolve(completeData);
    });

    // Error handling
    readStream.on('error', (error) => {
      console.error('❌ Stream error:', error);
      reject(error);
    });
  });
}

/**
 * Write file using STREAM
 */
function writeFileWithStream(filePath, data) {
  console.log('🌊 Writing with STREAM...');

  return new Promise((resolve, reject) => {
    // Create writable stream
    const writeStream = fs.createWriteStream(filePath);

    // Write data (can be in chunks)
    writeStream.write(data);

    // Close stream
    writeStream.end();

    // Finish event
    writeStream.on('finish', () => {
      console.log('✓ File written successfully (streamed)!');
      resolve();
    });

    // Error handling
    writeStream.on('error', (error) => {
      console.error('❌ Stream error:', error);
      reject(error);
    });
  });
}

// ============================================
// COPY FILE - BUFFER vs STREAM COMPARISON
// ============================================

/**
 * Copy file using BUFFER
 * - Memory mein pura file load hoga
 */
function copyFileWithBuffer(source, destination) {
  console.log('\n📦 BUFFER APPROACH:');
  console.log(`Copying: ${source} → ${destination}`);

  const startTime = Date.now();

  // Read pura file
  const data = fs.readFileSync(source);

  // Write pura file
  fs.writeFileSync(destination, data);

  const timeTaken = Date.now() - startTime;
  console.log(`✓ Copied in ${timeTaken}ms`);
  console.log(`✓ Memory used: ${(data.length / 1024 / 1024).toFixed(2)} MB\n`);
}

/**
 * Copy file using STREAM
 * - Memory mein sirf chunks load honge
 */
function copyFileWithStream(source, destination) {
  console.log('🌊 STREAM APPROACH:');
  console.log(`Copying: ${source} → ${destination}`);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const readStream = fs.createReadStream(source);
    const writeStream = fs.createWriteStream(destination);

    // Pipe - automatic data flow between streams
    readStream.pipe(writeStream);

    writeStream.on('finish', () => {
      const timeTaken = Date.now() - startTime;
      console.log(`✓ Copied in ${timeTaken}ms`);
      console.log('✓ Memory efficient (chunks only loaded)\n');
      resolve();
    });

    readStream.on('error', reject);
    writeStream.on('error', reject);
  });
}

// ============================================
// EXAMPLE USAGE
// ============================================

async function demonstrateBufferVsStream() {
  console.log('='.repeat(50));
  console.log('BUFFER vs STREAM DEMONSTRATION');
  console.log('='.repeat(50));

  // Create test file
  const testFile = path.join(__dirname, '../test-file.txt');
  const testData = 'Hello World! '.repeat(100); // Small data for demo
  fs.writeFileSync(testFile, testData);

  console.log('\n--- READING FILES ---\n');

  // 1. Buffer read
  const bufferData = readFileWithBuffer(testFile);
  console.log();

  // 2. Stream read
  await readFileWithStream(testFile);

  console.log('\n--- COPYING FILES ---\n');

  // 3. Buffer copy
  copyFileWithBuffer(testFile, testFile.replace('.txt', '-buffer-copy.txt'));

  // 4. Stream copy
  await copyFileWithStream(testFile, testFile.replace('.txt', '-stream-copy.txt'));

  console.log('='.repeat(50));
  console.log('DEMO COMPLETE!');
  console.log('='.repeat(50));
}

// ============================================
// WHEN TO USE WHAT?
// ============================================

/**
 * USE BUFFER when:
 * ✓ File size is small (< 10 MB)
 * ✓ Need to process entire file at once
 * ✓ Fast random access needed
 * ✓ Example: Profile pictures, small PDFs, JSON files
 *
 * USE STREAM when:
 * ✓ File size is large (> 10 MB)
 * ✓ Memory is limited
 * ✓ Processing can be done in chunks
 * ✓ Example: Videos, large logs, CSV exports, file uploads
 */

module.exports = {
  readFileWithBuffer,
  writeFileWithBuffer,
  readFileWithStream,
  writeFileWithStream,
  copyFileWithBuffer,
  copyFileWithStream,
  demonstrateBufferVsStream
};
