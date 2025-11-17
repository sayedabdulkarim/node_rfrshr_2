// ============================================
// FILE HANDLING ROUTES - Buffer vs Stream Demo
// ============================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Worker } = require('worker_threads');
const sharp = require('sharp');
const {
  readFileWithBuffer,
  readFileWithStream,
  copyFileWithBuffer,
  copyFileWithStream
} = require('../utils/fileHandling');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

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

// ============================================
// STREAM UPLOAD ROUTE
// ============================================

router.post('/stream', upload.single('file'), async (req, res) => {
  try {
    console.log('\n🌊 === STREAM UPLOAD STARTED ===');
    console.log(`   File: ${req.file.originalname}`);
    console.log(`   Size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   Path: ${req.file.path}`);

    // File is already uploaded using multer (which uses streams internally)
    // Multer automatically handles chunked upload

    console.log('🌊 === STREAM UPLOAD COMPLETED ===\n');

    res.json({
      success: true,
      message: 'File uploaded successfully using Stream!',
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        sizeMB: (req.file.size / (1024 * 1024)).toFixed(2),
        path: req.file.path
      }
    });
  } catch (error) {
    console.error('Stream upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// BLOCKING - Process WITHOUT Worker Thread
// ============================================

router.post('/process-blocking', upload.single('file'), async (req, res) => {
  try {
    console.log('\n🔴 === BLOCKING DEMO STARTED (No Worker Thread) ===');
    console.log(`   File: ${req.file.originalname}`);
    console.log(`   Size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log('   ⚠️  SERVER WILL BE BLOCKED DURING PROCESSING!');

    // Validate image file
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'Only image files are supported!'
      });
    }

    const inputPath = req.file.path;
    const outputPath = path.join(
      uploadsDir,
      'blocking-resized-' + req.file.filename
    );

    const startTime = Date.now();

    // ============================================
    // HEAVY CPU TASK - Simulates real image processing
    // This BLOCKS the entire server!
    // ============================================
    console.log('   🔴 Adding CPU-intensive work (BLOCKS main thread)...');

    // Heavy computation loop - BLOCKS EVENT LOOP!
    let dummySum = 0;
    for (let i = 0; i < 2000000000; i++) {  // 2 billion iterations
      dummySum += Math.sqrt(i);
    }
    console.log('   🔴 Heavy computation completed (server was frozen!)');

    // Process image DIRECTLY in main thread (BLOCKING!)
    const info = await sharp(inputPath)
      .resize(800, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFile(outputPath);

    const processingTime = Date.now() - startTime;

    console.log(`🔴 BLOCKING processing completed in ${processingTime}ms`);
    console.log('   ⚠️  Server was BLOCKED during this time!');
    console.log('🔴 === BLOCKING DEMO COMPLETED ===\n');

    res.json({
      success: true,
      message: 'Image processed (Server was BLOCKED!)',
      method: '🔴 BLOCKING (No Worker Thread)',
      original: {
        filename: req.file.originalname,
        size: req.file.size,
        sizeMB: (req.file.size / (1024 * 1024)).toFixed(2)
      },
      processed: {
        filename: 'blocking-resized-' + req.file.filename,
        size: info.size,
        sizeMB: (info.size / (1024 * 1024)).toFixed(2),
        dimensions: {
          width: info.width,
          height: info.height
        },
        processingTime: `${processingTime}ms`
      },
      warning: '⚠️ Server was completely blocked during this processing!'
    });

  } catch (error) {
    console.error('Blocking process error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// NON-BLOCKING - Process WITH Worker Thread
// ============================================

router.post('/process-worker', upload.single('file'), async (req, res) => {
  try {
    console.log('\n🟢 === NON-BLOCKING DEMO STARTED (With Worker Thread) ===');
    console.log(`   File: ${req.file.originalname}`);
    console.log(`   Size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log('   ✅ SERVER WILL STAY RESPONSIVE!');

    // Validate image file
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'Only image files are supported for worker demo!'
      });
    }

    const inputPath = req.file.path;
    const outputPath = path.join(
      uploadsDir,
      'worker-resized-' + req.file.filename
    );

    console.log('   🧵 Creating worker thread for image processing...');

    // Create worker thread for image processing
    const worker = new Worker(
      path.join(__dirname, '../demo/worker_threads/imageProcessor.worker.js'),
      {
        workerData: {
          inputPath,
          outputPath,
          width: 800,
          height: 600
        }
      }
    );

    // Listen for messages from worker
    worker.on('message', (result) => {
      if (result.success) {
        console.log('🟢 NON-BLOCKING processing completed');
        console.log('   ✅ Server was NEVER blocked!');
        console.log('🟢 === NON-BLOCKING DEMO COMPLETED ===\n');

        res.json({
          success: true,
          message: 'Image processed (Server stayed responsive!)',
          method: '🟢 NON-BLOCKING (With Worker Thread)',
          original: {
            filename: req.file.originalname,
            size: result.originalSize,
            sizeMB: (result.originalSize / (1024 * 1024)).toFixed(2)
          },
          processed: {
            filename: 'worker-resized-' + req.file.filename,
            size: result.newSize,
            sizeMB: (result.newSize / (1024 * 1024)).toFixed(2),
            dimensions: result.dimensions,
            processingTime: `${result.processingTime}ms`
          },
          advantage: '✅ Server handled other requests during processing!'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    });

    // Handle worker errors
    worker.on('error', (error) => {
      console.error('Worker error:', error);
      res.status(500).json({
        success: false,
        error: 'Worker thread failed: ' + error.message
      });
    });

    // Handle worker exit
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
    });

  } catch (error) {
    console.error('Worker upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
