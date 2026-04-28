import React, { useState } from "react";

const API = "http://localhost:5050/api/session";

const SessionDemo = () => {
  const [email, setEmail] = useState("sayed@test.com");
  const [password, setPassword] = useState("123456");
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const makeRequest = async (url, method = "GET") => {
    try {
      setError(null);
      const options = {
        method,
        credentials: "include", // important — cookie bhejne ke liye
        headers: { "Content-Type": "application/json" },
      };
      if (method === "POST") {
        options.body = JSON.stringify({ email, password });
      }
      const res = await fetch(url, options);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        setResponse(null);
      } else {
        setResponse(data);
        setError(null);
      }
    } catch (err) {
      setError("Server not running. Start sessionServer.js first!");
    }
  };

  const btnStyle = {
    padding: "10px 20px",
    margin: "5px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "14px",
    color: "white",
  };

  return (
    <div style={{ padding: "30px", maxWidth: "600px", margin: "0 auto", fontFamily: "monospace" }}>
      <h2>Session Management Demo</h2>

      {/* Login Form */}
      <div style={{ background: "#1e1e1e", padding: "20px", borderRadius: "10px", marginBottom: "20px" }}>
        <h3 style={{ color: "#4fc3f7" }}>Login</h3>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={{ padding: "8px", marginRight: "10px", width: "200px" }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ padding: "8px", width: "150px" }}
        />
        <br />
        <small style={{ color: "#888" }}>
          Premium: sayed@test.com | Free: test@test.com | Password: 123456
        </small>
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: "20px" }}>
        <button
          style={{ ...btnStyle, background: "#4caf50" }}
          onClick={() => makeRequest(`${API}/login`, "POST")}
        >
          Login (Create Session)
        </button>
        <button
          style={{ ...btnStyle, background: "#2196f3" }}
          onClick={() => makeRequest(`${API}/profile`)}
        >
          Get Profile (Check Session)
        </button>
        <button
          style={{ ...btnStyle, background: "#ff9800" }}
          onClick={() => makeRequest(`${API}/premium-content`)}
        >
          Premium Content (Authorization)
        </button>
        <button
          style={{ ...btnStyle, background: "#f44336" }}
          onClick={() => makeRequest(`${API}/logout`, "POST")}
        >
          Logout (Destroy Session)
        </button>
      </div>

      {/* Response */}
      {response && (
        <div style={{ background: "#1b5e20", padding: "15px", borderRadius: "10px", marginBottom: "10px" }}>
          <h4 style={{ color: "#a5d6a7" }}>Success:</h4>
          <pre style={{ color: "#c8e6c9" }}>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#b71c1c", padding: "15px", borderRadius: "10px" }}>
          <h4 style={{ color: "#ef9a9a" }}>Error:</h4>
          <pre style={{ color: "#ffcdd2" }}>{error}</pre>
        </div>
      )}

      {/* Flow Explanation */}
      <div style={{ background: "#263238", padding: "15px", borderRadius: "10px", marginTop: "20px", color: "#b0bec5" }}>
        <h4 style={{ color: "#4fc3f7" }}>Flow:</h4>
        <p>1. Click <b>Login</b> → Session create hoga (cookie set)</p>
        <p>2. Click <b>Get Profile</b> → Session se user milega</p>
        <p>3. Click <b>Premium Content</b> → Authorization check (premium/free)</p>
        <p>4. Click <b>Logout</b> → Session destroy, cookie clear</p>
        <p>5. Ab <b>Get Profile</b> click karo → "Not logged in" error aayega</p>
      </div>
    </div>
  );
};

export default SessionDemo;
