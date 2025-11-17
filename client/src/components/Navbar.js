import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={styles.navbar}>
      <div style={styles.container}>
        <Link to="/" style={styles.logo}>
          Todo App
        </Link>

        <div style={styles.links}>
          {user ? (
            <>
              <span style={styles.username}>Hi, {user.name}</span>
              <Link to="/dashboard" style={styles.link}>
                Dashboard
              </Link>

              {/* Profile Dropdown */}
              <div style={styles.dropdownContainer}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  style={styles.profileIcon}
                  title="Profile"
                >
                  👤
                </button>

                {showDropdown && (
                  <div style={styles.dropdownMenu}>
                    <Link
                      to="/profile"
                      style={styles.dropdownItem}
                      onClick={() => setShowDropdown(false)}
                    >
                      📦 Buffer Demo
                    </Link>
                    <Link
                      to="/profile/stream"
                      style={styles.dropdownItem}
                      onClick={() => setShowDropdown(false)}
                    >
                      🌊 Stream Demo
                    </Link>
                    <Link
                      to="/profile/worker"
                      style={styles.dropdownItem}
                      onClick={() => setShowDropdown(false)}
                    >
                      ⚡ Blocking vs Non-Blocking
                    </Link>
                  </div>
                )}
              </div>

              <button onClick={handleLogout} style={styles.logoutBtn}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={styles.link}>
                Login
              </Link>
              <Link to="/register" style={styles.link}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const styles = {
  navbar: {
    backgroundColor: '#333',
    padding: '1rem 0',
    marginBottom: '2rem'
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logo: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '1.5rem',
    fontWeight: 'bold'
  },
  links: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center'
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    transition: 'background-color 0.3s'
  },
  username: {
    color: '#ddd'
  },
  dropdownContainer: {
    position: 'relative'
  },
  profileIcon: {
    color: 'white',
    fontSize: '1.8rem',
    padding: '0.5rem',
    borderRadius: '50%',
    backgroundColor: '#555',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.3s',
    border: 'none',
    cursor: 'pointer'
  },
  dropdownMenu: {
    position: 'absolute',
    top: '50px',
    right: '0',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    minWidth: '220px',
    overflow: 'hidden',
    zIndex: 1000
  },
  dropdownItem: {
    display: 'block',
    padding: '12px 20px',
    color: '#333',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    borderBottom: '1px solid #eee'
  },
  logoutBtn: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default Navbar;