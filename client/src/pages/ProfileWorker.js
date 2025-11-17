import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function ProfileWorker() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingTime, setProcessingTime] = useState(null);
  const [processingMethod, setProcessingMethod] = useState(null);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];

    if (file) {
      // Check file size (max 500MB)
      if (file.size > 500 * 1024 * 1024) {
        setMessage('❌ File too large! Max 500MB allowed.');
        return;
      }

      // Check file type (only images for worker demo)
      if (!file.type.startsWith('image/')) {
        setMessage('❌ Please select an image file for this demo!');
        return;
      }

      setSelectedFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);

      setMessage('');
      setUploadProgress(0);
      setProcessingTime(null);
    }
  };

  // Process WITHOUT Worker Thread (BLOCKING)
  const processBlocking = async () => {
    if (!selectedFile) {
      setMessage('❌ Please select a file first!');
      return;
    }

    setUploading(true);
    setMessage('🔴 Processing WITHOUT Worker Thread (Server will BLOCK!)...');
    setUploadProgress(0);
    setProcessingTime(null);
    setProcessingMethod(null);

    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(
        'http://localhost:5001/api/files/process-blocking',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${user.token}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        }
      );

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      setProcessingTime(duration);
      setProcessingMethod('blocking');

      setMessage(`${response.data.message}`);
      console.log('Blocking result:', response.data);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('❌ Upload failed! Check console.');
    } finally {
      setUploading(false);
    }
  };

  // Process WITH Worker Thread (NON-BLOCKING)
  const processWorker = async () => {
    if (!selectedFile) {
      setMessage('❌ Please select a file first!');
      return;
    }

    setUploading(true);
    setMessage('🟢 Processing WITH Worker Thread (Server stays responsive!)...');
    setUploadProgress(0);
    setProcessingTime(null);
    setProcessingMethod(null);

    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(
        'http://localhost:5001/api/files/process-worker',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${user.token}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        }
      );

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      setProcessingTime(duration);
      setProcessingMethod('worker');

      setMessage(`${response.data.message}`);
      console.log('Worker result:', response.data);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('❌ Upload failed! Check console.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1>⚡ Blocking vs Non-Blocking Demo</h1>

      <div style={styles.userInfo}>
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
      </div>

      <div style={styles.uploadSection}>
        <h2>Blocking vs Non-Blocking Comparison</h2>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Compare image processing WITH and WITHOUT Worker Threads
        </p>

        {/* File Input */}
        <div style={styles.fileInput}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={styles.input}
          />
        </div>

        {/* Preview */}
        {preview && (
          <div style={styles.preview}>
            <h3>Preview:</h3>
            <img src={preview} alt="Preview" style={styles.previewImage} />
          </div>
        )}

        {/* File Info */}
        {selectedFile && (
          <div style={styles.fileInfo}>
            <p><strong>File:</strong> {selectedFile.name}</p>
            <p><strong>Size:</strong> {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
            <p><strong>Type:</strong> {selectedFile.type}</p>
            <p><strong>Dimensions:</strong> Will be resized to 800x600</p>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div style={styles.progressContainer}>
            <div style={{ ...styles.progressBar, width: `${uploadProgress}%` }}>
              {uploadProgress}%
            </div>
          </div>
        )}

        {/* Processing Time */}
        {processingTime && (
          <div style={styles.timeInfo}>
            ⏱️ Total time: <strong>{processingTime}s</strong>
          </div>
        )}

        {/* Upload Buttons - Compare both methods */}
        <div style={styles.buttons}>
          <button
            onClick={processBlocking}
            disabled={!selectedFile || uploading}
            style={{
              ...styles.button,
              backgroundColor: !selectedFile || uploading ? '#ccc' : '#dc3545'
            }}
          >
            {uploading ? '⏳ Processing...' : '🔴 Process WITHOUT Worker (BLOCKING)'}
          </button>

          <button
            onClick={processWorker}
            disabled={!selectedFile || uploading}
            style={{
              ...styles.button,
              backgroundColor: !selectedFile || uploading ? '#ccc' : '#28a745'
            }}
          >
            {uploading ? '⏳ Processing...' : '🟢 Process WITH Worker (NON-BLOCKING)'}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            ...styles.message,
            backgroundColor: message.includes('✅') ? '#d4edda' : message.includes('❌') ? '#f8d7da' : '#fff3cd'
          }}>
            {message}
          </div>
        )}

        {/* Info Box */}
        <div style={styles.infoBox}>
          <h3>⚡ Blocking vs Non-Blocking - The Difference</h3>

          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#ffe0e0', borderRadius: '4px' }}>
            <p><strong>🔴 WITHOUT Worker Thread (BLOCKING):</strong></p>
            <ul>
              <li>Image resize hoti hai MAIN thread mein</li>
              <li>⚠️ Server <strong>COMPLETELY BLOCKED</strong> during processing</li>
              <li>Koi bhi aur request handle nahi hogi (hung server!)</li>
              <li>Single-threaded limitation</li>
            </ul>
          </div>

          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e0ffe0', borderRadius: '4px' }}>
            <p><strong>🟢 WITH Worker Thread (NON-BLOCKING):</strong></p>
            <ul>
              <li>Image resize hoti hai SEPARATE thread mein</li>
              <li>✅ Server <strong>STAYS RESPONSIVE</strong> during processing</li>
              <li>Other requests bhi handle hoti rahti hain!</li>
              <li>True parallel processing</li>
            </ul>
          </div>

          <div style={{ marginTop: '15px' }}>
            <p><strong>🧪 Test karne ka tarika:</strong></p>
            <ol>
              <li>Ek large image select karo (2-5 MB)</li>
              <li>🔴 BLOCKING button click karo</li>
              <li>Jab tak processing chal rahi hai, try karo dashboard open karna - <strong>HANG!</strong></li>
              <li>Phir 🟢 NON-BLOCKING button try karo</li>
              <li>Processing ke dauran dashboard open karo - <strong>WORKS!</strong></li>
            </ol>
          </div>

          <div style={{ marginTop: '15px' }}>
            <p><strong>Real-world Impact:</strong></p>
            <ul>
              <li>Instagram: 1000s of images upload hote hain simultaneously</li>
              <li>Without workers: Server crash! Users frustrated!</li>
              <li>With workers: Smooth experience, server responsive!</li>
            </ul>
          </div>

          <p style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
            💡 Check server console to see BLOCKING vs NON-BLOCKING logs!
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px'
  },
  userInfo: {
    backgroundColor: '#f5f5f5',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '30px'
  },
  uploadSection: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  fileInput: {
    marginTop: '20px'
  },
  input: {
    padding: '10px',
    width: '100%',
    border: '2px dashed #ccc',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  preview: {
    marginTop: '20px',
    textAlign: 'center'
  },
  previewImage: {
    maxWidth: '300px',
    maxHeight: '300px',
    borderRadius: '8px',
    border: '2px solid #ddd'
  },
  fileInfo: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    fontSize: '14px'
  },
  progressContainer: {
    marginTop: '20px',
    width: '100%',
    height: '30px',
    backgroundColor: '#e0e0e0',
    borderRadius: '15px',
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#9C27B0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    transition: 'width 0.3s ease'
  },
  timeInfo: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#fff3cd',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '14px'
  },
  buttons: {
    display: 'flex',
    gap: '15px',
    marginTop: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'opacity 0.3s'
  },
  message: {
    marginTop: '20px',
    padding: '15px',
    borderRadius: '4px',
    textAlign: 'center'
  },
  infoBox: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#f3e5f5',
    borderRadius: '8px',
    fontSize: '14px'
  }
};

export default ProfileWorker;
