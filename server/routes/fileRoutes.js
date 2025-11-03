// ============================================
// FILE HANDLING ROUTES - Buffer vs Stream Demo
// ============================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const {
  readFileWithBuffer,
  readFileWithStream,
  copyFileWithBuffer,
  copyFileWithStream
} = require('../utils/fileHandling');

// ============================================
// DEMO ROUTE - Compare Buffer vs Stream
// ============================================

router.get('/demo', async (req, res) => {
  try {
    console.log('\n=== File Handling Demo Started ===\n');

    // Create a test file
    const testFile = path.join(__dirname, '../temp-test-file.txt');
    const testData = 'Hello from Node.js! '.repeat(100);
    fs.writeFileSync(testFile, testData);

    const results = {
      message: 'Buffer vs Stream Demonstration',
      testFileSize: `${(testData.length / 1024).toFixed(2)} KB`,
      demonstrations: []
    };

    // 1. Buffer Read Demo
    console.log('--- BUFFER READ ---');
    const bufferStart = Date.now();
    const bufferData = readFileWithBuffer(testFile);
    const bufferTime = Date.now() - bufferStart;

    results.demonstrations.push({
      method: 'Buffer Read',
      time: `${bufferTime}ms`,
      description: 'Pura file memory mein load hua',
      dataSize: `${bufferData.length} bytes`
    });

    // 2. Stream Read Demo
    console.log('\n--- STREAM READ ---');
    const streamStart = Date.now();
    const streamData = await readFileWithStream(testFile);
    const streamTime = Date.now() - streamStart;

    results.demonstrations.push({
      method: 'Stream Read',
      time: `${streamTime}ms`,
      description: 'File chunks mein read hua',
      dataSize: `${streamData.length} bytes`
    });

    // 3. Buffer Copy Demo
    console.log('\n--- BUFFER COPY ---');
    const bufferCopyStart = Date.now();
    copyFileWithBuffer(testFile, testFile.replace('.txt', '-buffer.txt'));
    const bufferCopyTime = Date.now() - bufferCopyStart;

    results.demonstrations.push({
      method: 'Buffer Copy',
      time: `${bufferCopyTime}ms`,
      description: 'Pura file ek baar mein copy'
    });

    // 4. Stream Copy Demo
    console.log('\n--- STREAM COPY ---');
    const streamCopyStart = Date.now();
    await copyFileWithStream(testFile, testFile.replace('.txt', '-stream.txt'));
    const streamCopyTime = Date.now() - streamCopyStart;

    results.demonstrations.push({
      method: 'Stream Copy',
      time: `${streamCopyTime}ms`,
      description: 'File chunks mein copy (memory efficient)'
    });

    // Cleanup test files
    fs.unlinkSync(testFile);
    fs.unlinkSync(testFile.replace('.txt', '-buffer.txt'));
    fs.unlinkSync(testFile.replace('.txt', '-stream.txt'));

    console.log('\n=== Demo Complete ===\n');

    res.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Error in file demo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// INFO ROUTE - When to use what
// ============================================

router.get('/info', (req, res) => {
  res.json({
    success: true,
    info: {
      buffer: {
        description: 'Pura file memory mein load hota hai',
        useCases: [
          'Small files (< 10 MB)',
          'Profile pictures',
          'Small PDFs',
          'JSON files',
          'Quick file operations'
        ],
        pros: ['Fast access', 'Simple to use', 'Random access possible'],
        cons: ['High memory usage', 'Can crash on large files']
      },
      stream: {
        description: 'File chunks (टुकड़ों) mein process hota hai',
        useCases: [
          'Large files (> 10 MB)',
          'Video files',
          'Large logs',
          'CSV exports',
          'File uploads'
        ],
        pros: ['Memory efficient', 'Handles large files', 'Non-blocking'],
        cons: ['Slower than buffer', 'More complex code']
      }
    }
  });
});

module.exports = router;
