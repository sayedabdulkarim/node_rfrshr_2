import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function ProfileStream() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];

    if (file) {
      // Check file size (max 500MB)
      if (file.size > 500 * 1024 * 1024) {
        setMessage('❌ File too large! Max 500MB allowed.');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        setMessage('❌ Please select an image or video file!');
        return;
      }

      setSelectedFile(file);

      // Create preview for images only
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
      setMessage('');
      setUploadProgress(0);
    }
  };

  // Upload using STREAM
  const uploadWithStream = async () => {
    if (!selectedFile) {
      setMessage('❌ Please select a file first!');
      return;
    }

    setUploading(true);
    setMessage('🌊 Uploading with Stream...');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(
        'http://localhost:5001/api/files/stream',
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

      setMessage(`✅ ${response.data.message}`);
      console.log('Upload result:', response.data);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('❌ Upload failed! Check console.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1>🌊 Stream Demo</h1>

      <div style={styles.userInfo}>
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
      </div>

      <div style={styles.uploadSection}>
        <h2>Stream File Upload</h2>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Memory-efficient file upload using streams (Max: 500MB)
        </p>

        {/* File Input */}
        <div style={styles.fileInput}>
          <input
            type="file"
            accept="image/*,video/*"
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

        {/* Upload Button */}
        <div style={styles.buttons}>
          <button
            onClick={uploadWithStream}
            disabled={!selectedFile || uploading}
            style={{
              ...styles.button,
              backgroundColor: !selectedFile || uploading ? '#ccc' : '#2196F3'
            }}
          >
            {uploading ? '⏳ Uploading...' : '🌊 Upload with Stream'}
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
          <h3>🌊 Stream Upload - How it works?</h3>

          <div style={{ marginTop: '15px' }}>
            <p><strong>What happens:</strong></p>
            <ul>
              <li>File is read and uploaded in small chunks (64KB at a time)</li>
              <li>Memory usage stays constant regardless of file size</li>
              <li>Server processes data as it arrives (pipe-based)</li>
              <li>Perfect for large videos and files</li>
            </ul>
          </div>

          <div style={{ marginTop: '15px' }}>
            <p><strong>Advantages:</strong></p>
            <ul>
              <li>✅ Memory efficient - No matter how big the file!</li>
              <li>✅ Can handle GB-sized files easily</li>
              <li>✅ Server stays responsive during upload</li>
              <li>✅ Progress tracking available</li>
            </ul>
          </div>

          <div style={{ marginTop: '15px' }}>
            <p><strong>Use cases:</strong></p>
            <ul>
              <li>Video uploads (movies, recordings)</li>
              <li>Large images (high-res photos)</li>
              <li>File downloads</li>
              <li>Log file processing</li>
            </ul>
          </div>

          <p style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
            💡 Check server console to see stream chunks being processed!
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
    backgroundColor: '#2196F3',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    transition: 'width 0.3s ease'
  },
  buttons: {
    display: 'flex',
    gap: '15px',
    marginTop: '20px',
    justifyContent: 'center'
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
    backgroundColor: '#e3f2fd',
    borderRadius: '8px',
    fontSize: '14px'
  }
};

export default ProfileStream;
