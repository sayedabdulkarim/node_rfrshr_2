import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <div style={styles.container}>
      <h1>Welcome to Todo App</h1>
      <p style={styles.subtitle}>Manage your tasks efficiently with protected routes</p>

      <div style={styles.features}>
        <div style={styles.feature}>
          <h3>Protected Routes</h3>
          <p>Dashboard is only accessible after login</p>
        </div>
        <div style={styles.feature}>
          <h3>Todo CRUD</h3>
          <p>Create, Read, Update, Delete todos</p>
        </div>
        <div style={styles.feature}>
          <h3>Local Storage</h3>
          <p>Your session persists even after refresh</p>
        </div>
      </div>

      <div style={styles.cta}>
        {user ? (
          <Link to="/dashboard" style={styles.ctaButton}>
            Go to Dashboard
          </Link>
        ) : (
          <>
            <Link to="/login" style={styles.ctaButton}>
              Login
            </Link>
            <Link to="/register" style={{...styles.ctaButton, ...styles.secondaryButton}}>
              Register
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    textAlign: 'center',
    padding: '2rem'
  },
  subtitle: {
    color: '#666',
    fontSize: '1.2rem',
    marginBottom: '3rem'
  },
  features: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    flexWrap: 'wrap',
    marginBottom: '3rem'
  },
  feature: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    width: '250px'
  },
  cta: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center'
  },
  ctaButton: {
    display: 'inline-block',
    padding: '1rem 2rem',
    backgroundColor: '#007bff',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '1.1rem'
  },
  secondaryButton: {
    backgroundColor: '#6c757d'
  }
};

export default Home;