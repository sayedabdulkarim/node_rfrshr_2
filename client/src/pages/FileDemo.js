import React, { useState } from 'react';
import axios from 'axios';

function FileDemo() {
  const [results, setResults] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Run Buffer vs Stream demo
  const runDemo = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5001/api/files/demo');
      setResults(response.data);
      console.log('Demo Results:', response.data);
    } catch (error) {
      console.error('Error:', error);
      alert('Error running demo. Check console!');
    } finally {
      setLoading(false);
    }
  };

  // Get info about Buffer vs Stream
  const getInfo = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/files/info');
      setInfo(response.data.info);
      console.log('Info:', response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>📦 Buffer vs 🌊 Stream Demo</h1>
      <p style={{ color: '#666' }}>
        Learn the difference between Buffer and Stream in Node.js
      </p>

      <div style={{ marginTop: '30px' }}>
        <button
          onClick={runDemo}
          disabled={loading}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            marginRight: '10px'
          }}
        >
          {loading ? 'Running...' : '🚀 Run Demo'}
        </button>

        <button
          onClick={getInfo}
          style={{
            padding: '12px 24px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ℹ️ Show Info
        </button>
      </div>

      {/* Demo Results */}
      {results && (
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <h2>✅ Demo Results</h2>
          <p><strong>Test File Size:</strong> {results.testFileSize}</p>

          <div style={{ marginTop: '20px' }}>
            {results.demonstrations.map((demo, index) => (
              <div
                key={index}
                style={{
                  padding: '15px',
                  marginBottom: '15px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  borderLeft: '4px solid #4CAF50'
                }}
              >
                <h3 style={{ margin: '0 0 10px 0' }}>{demo.method}</h3>
                <p style={{ margin: '5px 0', color: '#666' }}>{demo.description}</p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Time:</strong> {demo.time}
                </p>
                {demo.dataSize && (
                  <p style={{ margin: '5px 0' }}>
                    <strong>Data Size:</strong> {demo.dataSize}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      {info && (
        <div style={{ marginTop: '30px' }}>
          <h2>📚 When to Use What?</h2>

          {/* Buffer Info */}
          <div style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
            <h3>📦 Buffer</h3>
            <p>{info.buffer.description}</p>

            <div style={{ marginTop: '15px' }}>
              <h4>Use Cases:</h4>
              <ul>
                {info.buffer.useCases.map((useCase, index) => (
                  <li key={index}>{useCase}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: '15px' }}>
              <h4>✅ Pros:</h4>
              <ul>
                {info.buffer.pros.map((pro, index) => (
                  <li key={index} style={{ color: 'green' }}>{pro}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: '15px' }}>
              <h4>❌ Cons:</h4>
              <ul>
                {info.buffer.cons.map((con, index) => (
                  <li key={index} style={{ color: 'red' }}>{con}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stream Info */}
          <div style={{ padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
            <h3>🌊 Stream</h3>
            <p>{info.stream.description}</p>

            <div style={{ marginTop: '15px' }}>
              <h4>Use Cases:</h4>
              <ul>
                {info.stream.useCases.map((useCase, index) => (
                  <li key={index}>{useCase}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: '15px' }}>
              <h4>✅ Pros:</h4>
              <ul>
                {info.stream.pros.map((pro, index) => (
                  <li key={index} style={{ color: 'green' }}>{pro}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: '15px' }}>
              <h4>❌ Cons:</h4>
              <ul>
                {info.stream.cons.map((con, index) => (
                  <li key={index} style={{ color: 'red' }}>{con}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
        <strong>💡 Note:</strong> Check the server console to see detailed logs of how Buffer and Stream work!
      </div>
    </div>
  );
}

export default FileDemo;
