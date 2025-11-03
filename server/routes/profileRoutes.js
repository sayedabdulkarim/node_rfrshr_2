// ============================================
// PROFILE ROUTES - File Upload (Buffer vs Stream)
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');

// Create uploads directory if not exists
const uploadDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ============================================
// MULTER CONFIGURATION - Uses BUFFER by default
// ============================================

// Storage configuration - Store in memory as buffer
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit (images + videos)
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files allowed!'), false);
    }
  }
});

// ============================================
// UPLOAD ROUTE - Supports both Buffer & Stream
// ============================================

router.post('/upload', protect, upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded!'
      });
    }

    const method = req.body.method || 'buffer'; // 'buffer' or 'stream'
    const fileName = `${req.user._id}-${Date.now()}${path.extname(req.file.originalname)}`;
    const filePath = path.join(uploadDir, fileName);

    console.log('\n=== Profile Picture Upload ===');
    console.log(`Method: ${method.toUpperCase()}`);
    console.log(`File: ${req.file.originalname}`);
    console.log(`Size: ${(req.file.size / 1024).toFixed(2)} KB`);
    console.log(`User: ${req.user.email}`);

    if (method === 'buffer') {
      // ============================================
      // APPROACH 1: BUFFER (Default with Multer)
      // ============================================
      console.log('\n📦 USING BUFFER:');
      console.log('  → File already in memory (req.file.buffer)');
      console.log(`  → Buffer size: ${req.file.buffer.length} bytes`);

      const startTime = Date.now();

      // Write buffer to disk in one go
      fs.writeFileSync(filePath, req.file.buffer);

      const timeTaken = Date.now() - startTime;
      console.log(`  ✓ File written in ${timeTaken}ms`);
      console.log(`  ✓ Saved to: ${filePath}`);

      return res.json({
        success: true,
        message: 'Profile picture uploaded successfully!',
        method: 'Buffer (Memory → Disk in one go)',
        file: {
          name: fileName,
          size: `${(req.file.size / 1024).toFixed(2)} KB`,
          path: filePath,
          timeTaken: `${timeTaken}ms`
        }
      });

    } else if (method === 'stream') {
      // ============================================
      // APPROACH 2: STREAM
      // ============================================
      console.log('\n🌊 USING STREAM:');
      console.log('  → Converting buffer to stream');

      const startTime = Date.now();

      // Create readable stream from buffer
      const { Readable } = require('stream');
      const bufferStream = new Readable();
      bufferStream.push(req.file.buffer);
      bufferStream.push(null); // Signal end of stream

      // Create writable stream to file
      const writeStream = fs.createWriteStream(filePath);

      let bytesWritten = 0;

      // Pipe data from readable to writable stream
      bufferStream.on('data', (chunk) => {
        bytesWritten += chunk.length;
        console.log(`  → Writing chunk: ${chunk.length} bytes (Total: ${bytesWritten})`);
      });

      // Use promise to wait for stream to finish
      await new Promise((resolve, reject) => {
        bufferStream.pipe(writeStream);

        writeStream.on('finish', () => {
          const timeTaken = Date.now() - startTime;
          console.log(`  ✓ Stream completed in ${timeTaken}ms`);
          console.log(`  ✓ Total bytes written: ${bytesWritten}`);
          console.log(`  ✓ Saved to: ${filePath}`);
          resolve();
        });

        writeStream.on('error', (error) => {
          console.error('  ❌ Stream error:', error);
          reject(error);
        });
      });

      const timeTaken = Date.now() - startTime;

      return res.json({
        success: true,
        message: 'Profile picture uploaded successfully!',
        method: 'Stream (Buffer → Stream → Disk in chunks)',
        file: {
          name: fileName,
          size: `${(req.file.size / 1024).toFixed(2)} KB`,
          path: filePath,
          timeTaken: `${timeTaken}ms`,
          bytesWritten
        }
      });
    }

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GET PROFILE PICTURE
// ============================================

router.get('/picture/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }
});

module.exports = router;
