import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { todoAPI } from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load todos from backend
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const data = await todoAPI.getAll();
      setTodos(data);
      setError('');
    } catch (error) {
      console.error('Error fetching todos:', error);
      setError('Failed to load todos');
    } finally {
      setLoading(false);
    }
  };

  // CREATE
  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    try {
      const newTodoData = await todoAPI.create(newTodo);
      setTodos([...todos, newTodoData]);
      setNewTodo('');
      setError('');
    } catch (error) {
      console.error('Error adding todo:', error);
      setError('Failed to add todo');
    }
  };

  // UPDATE - Toggle Complete
  const toggleComplete = async (id) => {
    try {
      const updatedTodo = await todoAPI.toggle(id);
      setTodos(todos.map(todo =>
        todo._id === id ? updatedTodo : todo
      ));
      setError('');
    } catch (error) {
      console.error('Error toggling todo:', error);
      setError('Failed to update todo');
    }
  };

  // UPDATE - Edit Todo
  const startEdit = (todo) => {
    setEditingId(todo._id);
    setEditText(todo.text);
  };

  const saveEdit = async () => {
    try {
      const updatedTodo = await todoAPI.update(editingId, { text: editText });
      setTodos(todos.map(todo =>
        todo._id === editingId ? updatedTodo : todo
      ));
      setEditingId(null);
      setEditText('');
      setError('');
    } catch (error) {
      console.error('Error updating todo:', error);
      setError('Failed to update todo');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  // DELETE
  const deleteTodo = async (id) => {
    if (window.confirm('Are you sure you want to delete this todo?')) {
      try {
        await todoAPI.delete(id);
        setTodos(todos.filter(todo => todo._id !== id));
        setError('');
      } catch (error) {
        console.error('Error deleting todo:', error);
        setError('Failed to delete todo');
      }
    }
  };

  // Stats
  const completedCount = todos.filter(t => t.completed).length;
  const pendingCount = todos.filter(t => !t.completed).length;

  if (loading) {
    return (
      <div style={styles.container}>
        <h1>Loading...</h1>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1>Dashboard - {user.name}</h1>

      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={fetchTodos} style={styles.retryBtn}>Retry</button>
        </div>
      )}

      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <h3>{todos.length}</h3>
          <p>Total Todos</p>
        </div>
        <div style={{...styles.statCard, backgroundColor: '#28a745'}}>
          <h3>{completedCount}</h3>
          <p>Completed</p>
        </div>
        <div style={{...styles.statCard, backgroundColor: '#ffc107'}}>
          <h3>{pendingCount}</h3>
          <p>Pending</p>
        </div>
      </div>

      {/* Add Todo Form */}
      <form onSubmit={addTodo} style={styles.addForm}>
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a new todo..."
          style={styles.input}
        />
        <button type="submit" style={styles.addButton}>
          Add Todo
        </button>
      </form>

      {/* Todo List */}
      <div style={styles.todoList}>
        {todos.length === 0 ? (
          <p style={styles.emptyMessage}>No todos yet. Add one above!</p>
        ) : (
          todos.map(todo => (
            <div key={todo._id} style={styles.todoItem}>
              {editingId === todo._id ? (
                // Edit Mode
                <div style={styles.editMode}>
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={styles.editInput}
                  />
                  <button onClick={saveEdit} style={styles.saveBtn}>Save</button>
                  <button onClick={cancelEdit} style={styles.cancelBtn}>Cancel</button>
                </div>
              ) : (
                // View Mode
                <>
                  <div style={styles.todoContent}>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleComplete(todo._id)}
                      style={styles.checkbox}
                    />
                    <span style={{
                      ...styles.todoText,
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      opacity: todo.completed ? 0.6 : 1
                    }}>
                      {todo.text}
                    </span>
                  </div>
                  <div style={styles.todoActions}>
                    <button
                      onClick={() => startEdit(todo)}
                      style={styles.editBtn}
                      disabled={todo.completed}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTodo(todo._id)}
                      style={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem'
  },
  errorBanner: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  retryBtn: {
    padding: '0.25rem 0.75rem',
    backgroundColor: '#721c24',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  stats: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    justifyContent: 'center'
  },
  statCard: {
    backgroundColor: '#007bff',
    color: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    textAlign: 'center',
    minWidth: '150px'
  },
  addForm: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem'
  },
  input: {
    flex: 1,
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px'
  },
  addButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  todoList: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '1rem'
  },
  todoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid #eee'
  },
  todoContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flex: 1
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  todoText: {
    fontSize: '1rem'
  },
  todoActions: {
    display: 'flex',
    gap: '0.5rem'
  },
  editBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#ffc107',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  deleteBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  editMode: {
    display: 'flex',
    gap: '0.5rem',
    width: '100%'
  },
  editInput: {
    flex: 1,
    padding: '0.5rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px'
  },
  saveBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  cancelBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#666',
    padding: '2rem'
  }
};

export default Dashboard;