import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function Profile() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

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

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setMessage('');
    }
  };

  // Upload profile picture using BUFFER
  const uploadWithBuffer = async () => {
    if (!selectedFile) {
      setMessage('❌ Please select a file first!');
      return;
    }

    setUploading(true);
    setMessage('📦 Uploading with Buffer...');

    try {
      const formData = new FormData();
      formData.append('profilePic', selectedFile);
      formData.append('method', 'buffer');

      const response = await axios.post(
        'http://localhost:5001/api/profile/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${user.token}`
          }
        }
      );

      setMessage(`✅ ${response.data.message} (${response.data.method})`);
      console.log('Upload result:', response.data);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('❌ Upload failed! Check console.');
    } finally {
      setUploading(false);
    }
  };

  // Upload profile picture using STREAM
  const uploadWithStream = async () => {
    if (!selectedFile) {
      setMessage('❌ Please select a file first!');
      return;
    }

    setUploading(true);
    setMessage('🌊 Uploading with Stream...');

    try {
      const formData = new FormData();
      formData.append('profilePic', selectedFile);
      formData.append('method', 'stream');

      const response = await axios.post(
        'http://localhost:5001/api/profile/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${user.token}`
          }
        }
      );

      setMessage(`✅ ${response.data.message} (${response.data.method})`);
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
      <h1>👤 Profile</h1>

      <div style={styles.userInfo}>
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
      </div>

      <div style={styles.uploadSection}>
        <h2>Upload File (Image or Video)</h2>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Compare Buffer vs Stream file upload methods (Max: 500MB)
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
            <p style={{ fontSize: '12px', color: '#666' }}>
              File: {selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(2)} KB)
            </p>
          </div>
        )}

        {/* Upload Buttons */}
        <div style={styles.buttons}>
          <button
            onClick={uploadWithBuffer}
            disabled={!selectedFile || uploading}
            style={{
              ...styles.button,
              backgroundColor: !selectedFile || uploading ? '#ccc' : '#4CAF50'
            }}
          >
            📦 Upload with Buffer
          </button>

          <button
            onClick={uploadWithStream}
            disabled={!selectedFile || uploading}
            style={{
              ...styles.button,
              backgroundColor: !selectedFile || uploading ? '#ccc' : '#2196F3'
            }}
          >
            🌊 Upload with Stream
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
          <h3>📚 What's happening?</h3>
          <div style={{ marginTop: '10px' }}>
            <p><strong>📦 Buffer:</strong></p>
            <ul>
              <li>Pura file memory mein load hota hai</li>
              <li>Fast processing for small files</li>
              <li>Best for: Small images (&lt; 10MB)</li>
            </ul>
          </div>
          <div style={{ marginTop: '15px' }}>
            <p><strong>🌊 Stream:</strong></p>
            <ul>
              <li>File chunks mein process hota hai</li>
              <li>Memory efficient</li>
              <li>Best for: Large videos (50MB+), movies</li>
            </ul>
          </div>
          <p style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
            💡 Check server console to see detailed logs!
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

export default Profile;
