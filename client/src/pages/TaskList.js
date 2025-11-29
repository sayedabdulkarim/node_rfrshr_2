import React, { useState, useEffect } from 'react';
import api from '../services/api';

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: ''
  });
  const [sort, setSort] = useState({
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 10
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async (searchTerm = '', filterOptions = filters, sortOptions = sort, page = 1, limit = 10) => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterOptions.status) params.append('status', filterOptions.status);
      if (filterOptions.priority) params.append('priority', filterOptions.priority);
      if (filterOptions.category) params.append('category', filterOptions.category);
      params.append('sortBy', sortOptions.sortBy);
      params.append('sortOrder', sortOptions.sortOrder);
      params.append('page', page);
      params.append('limit', limit);

      const queryString = `?${params.toString()}`;
      const response = await api.get(`/tasks${queryString}`);
      setTasks(response.data.data);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTasks(search, filters, sort);
  };

  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...filters, [filterName]: value };
    setFilters(newFilters);
    fetchTasks(search, newFilters, sort);
  };

  const handleSortChange = (field, value) => {
    const newSort = { ...sort, [field]: value };
    setSort(newSort);
    fetchTasks(search, filters, newSort);
  };

  const clearAll = () => {
    setSearch('');
    setFilters({ status: '', priority: '', category: '' });
    setSort({ sortBy: 'createdAt', sortOrder: 'desc' });
    fetchTasks('', { status: '', priority: '', category: '' }, { sortBy: 'createdAt', sortOrder: 'desc' }, 1, 10);
  };

  const handlePageChange = (newPage) => {
    fetchTasks(search, filters, sort, newPage, pagination.limit);
  };

  const handleLimitChange = (newLimit) => {
    fetchTasks(search, filters, sort, 1, newLimit);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: '#fef3c7', color: '#92400e' },
      in_progress: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' }
    };
    return styles[status] || styles.pending;
  };

  if (loading) return <div style={styles.loading}>Loading tasks...</div>;
  if (error) return <div style={styles.error}>Error: {error}</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Task List ({tasks.length} tasks)</h1>

      {/* Search Bar */}
      <form onSubmit={handleSearch} style={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search tasks by title, description, or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <button type="submit" style={styles.searchBtn}>Search</button>
      </form>

      {/* Filters */}
      <div style={styles.filterContainer}>
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={filters.priority}
          onChange={(e) => handleFilterChange('priority', e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All Category</option>
          <option value="work">Work</option>
          <option value="personal">Personal</option>
          <option value="shopping">Shopping</option>
          <option value="health">Health</option>
          <option value="finance">Finance</option>
          <option value="learning">Learning</option>
        </select>

        {(search || filters.status || filters.priority || filters.category) && (
          <button onClick={clearAll} style={styles.clearBtn}>
            Clear All
          </button>
        )}

        {/* Sort Controls */}
        <div style={styles.sortContainer}>
          <span style={styles.sortLabel}>Sort:</span>
          <select
            value={sort.sortBy}
            onChange={(e) => handleSortChange('sortBy', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="createdAt">Created Date</option>
            <option value="dueDate">Due Date</option>
            <option value="title">Title</option>
            <option value="priority">Priority</option>
          </select>
          <button
            onClick={() => handleSortChange('sortOrder', sort.sortOrder === 'asc' ? 'desc' : 'asc')}
            style={styles.sortOrderBtn}
          >
            {sort.sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
      </div>

      <div style={styles.taskGrid}>
        {tasks.map((task) => (
          <div key={task._id} style={styles.taskCard}>
            <div style={styles.cardHeader}>
              <span
                style={{
                  ...styles.priorityDot,
                  backgroundColor: getPriorityColor(task.priority)
                }}
              />
              <span style={styles.category}>{task.category}</span>
            </div>

            <h3 style={styles.taskTitle}>{task.title}</h3>
            <p style={styles.description}>{task.description}</p>

            <div style={styles.tags}>
              {task.tags.map((tag, i) => (
                <span key={i} style={styles.tag}>{tag}</span>
              ))}
            </div>

            <div style={styles.cardFooter}>
              <span
                style={{
                  ...styles.statusBadge,
                  backgroundColor: getStatusBadge(task.status).bg,
                  color: getStatusBadge(task.status).color
                }}
              >
                {task.status.replace('_', ' ')}
              </span>
              <span style={styles.dueDate}>
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div style={styles.paginationContainer}>
        <div style={styles.paginationInfo}>
          Showing {tasks.length} of {pagination.totalItems} tasks
        </div>

        <div style={styles.paginationControls}>
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
            style={{
              ...styles.pageBtn,
              opacity: pagination.hasPrevPage ? 1 : 0.5
            }}
          >
            ← Prev
          </button>

          {/* Page Numbers */}
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              style={{
                ...styles.pageBtn,
                backgroundColor: pageNum === pagination.currentPage ? '#3b82f6' : '#fff',
                color: pageNum === pagination.currentPage ? '#fff' : '#374151'
              }}
            >
              {pageNum}
            </button>
          ))}

          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
            style={{
              ...styles.pageBtn,
              opacity: pagination.hasNextPage ? 1 : 0.5
            }}
          >
            Next →
          </button>
        </div>

        <div style={styles.limitContainer}>
          <span>Per page:</span>
          <select
            value={pagination.limit}
            onChange={(e) => handleLimitChange(parseInt(e.target.value))}
            style={styles.limitSelect}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  title: {
    fontSize: '28px',
    marginBottom: '20px',
    color: '#1f2937'
  },
  searchContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  searchInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none'
  },
  searchBtn: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  clearBtn: {
    padding: '12px 24px',
    backgroundColor: '#6b7280',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  filterContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  filterSelect: {
    padding: '10px 16px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    minWidth: '150px'
  },
  sortContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginLeft: 'auto'
  },
  sortLabel: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: '500'
  },
  sortOrderBtn: {
    padding: '10px 16px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontWeight: '500'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px'
  },
  error: {
    textAlign: 'center',
    padding: '40px',
    color: '#ef4444'
  },
  taskGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px'
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  priorityDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  category: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  taskTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '8px',
    color: '#1f2937'
  },
  description: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '12px'
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginBottom: '12px'
  },
  tag: {
    fontSize: '11px',
    padding: '2px 8px',
    backgroundColor: '#f3f4f6',
    borderRadius: '12px',
    color: '#4b5563'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '4px',
    textTransform: 'capitalize'
  },
  dueDate: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  paginationContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  paginationInfo: {
    fontSize: '14px',
    color: '#6b7280'
  },
  paginationControls: {
    display: 'flex',
    gap: '4px'
  },
  pageBtn: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  limitContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#6b7280'
  },
  limitSelect: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  }
};

export default TaskList;
