import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Profile from './pages/Profile';
import ProfileStream from './pages/ProfileStream';
import ProfileWorker from './pages/ProfileWorker';
import TaskList from './pages/TaskList';
import SessionDemo from './pages/SessionDemo';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar />
          <div className="container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/stream"
                element={
                  <ProtectedRoute>
                    <ProfileStream />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/worker"
                element={
                  <ProtectedRoute>
                    <ProfileWorker />
                  </ProtectedRoute>
                }
              />
              <Route path="/tasks" element={<TaskList />} />
              <Route path="/session-demo" element={<SessionDemo />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;