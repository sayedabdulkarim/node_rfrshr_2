import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (localStorage check)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const userData = await authAPI.login(email, password);

      // Store user data with token and roles
      const userToStore = {
        id: userData._id,
        email: userData.email,
        name: userData.name,
        roles: userData.roles || [],
        token: userData.token
      };

      localStorage.setItem('user', JSON.stringify(userToStore));
      setUser(userToStore);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const userData = await authAPI.register(name, email, password);

      // Store user data with token and roles
      const userToStore = {
        id: userData._id,
        email: userData.email,
        name: userData.name,
        roles: userData.roles || [],
        token: userData.token
      };

      localStorage.setItem('user', JSON.stringify(userToStore));
      setUser(userToStore);
      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  // Helper: Check if user has specific role
  const hasRole = (roleName) => {
    if (!user || !user.roles) return false;
    return user.roles.some(role => role.name === roleName);
  };

  // Helper: Check if user has specific permission
  const hasPermission = (permission) => {
    if (!user || !user.roles) return false;
    return user.roles.some(role => role.permissions?.includes(permission));
  };

  // Helper: Get user's role names as array
  const getRoleNames = () => {
    if (!user || !user.roles) return [];
    return user.roles.map(role => role.name);
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
    hasRole,
    hasPermission,
    getRoleNames
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};