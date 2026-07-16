import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import './TasksDashboard.css';

const API_BASE_URL = 'http://localhost:4000/api/admin/tasks';

export default function TasksDashboard() {
  const { token } = useSelector((state) => state.auth);

  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [selectedSprintFilter, setSelectedSprintFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Status feedback
  const [status, setStatus] = useState({ type: '', message: '' });
  const statusTimeoutRef = useRef(null);

  // New Sprint Form states
  const [showAddSprint, setShowAddSprint] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');

  // New Task Form states
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    sprintId: '',
    title: '',
    description: '',
    assigneeId: '',
  });

  // Track original values for onBlur check (to only save if values actually changed)
  const originalValues = useRef({});

  // Helper to trigger status notification
  const showStatus = (type, message) => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    setStatus({ type, message });
    if (type === 'success') {
      statusTimeoutRef.current = setTimeout(() => {
        setStatus({ type: '', message: '' });
      }, 3000);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_BASE_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setTasks(response.data.tasks || []);
        setSprints(response.data.sprints || []);
        setUsers(response.data.users || []);

        // Pre-select first sprint in task form if available
        if (response.data.sprints?.length > 0) {
          setNewTask((prev) => ({ ...prev, sprintId: response.data.sprints[0]._id }));
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      showStatus('error', err.response?.data?.message || 'Không thể tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Handle Create Sprint
  const handleCreateSprint = async (e) => {
    e.preventDefault();
    if (!newSprintName.trim()) return;

    try {
      showStatus('loading', 'Đang tạo Sprint...');
      const response = await axios.post(
        `${API_BASE_URL}/sprints`,
        { name: newSprintName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setSprints((prev) => [...prev, response.data.sprint].sort((a, b) => a.name.localeCompare(b.name)));
        // Pre-select if it was empty
        if (!newTask.sprintId) {
          setNewTask((prev) => ({ ...prev, sprintId: response.data.sprint._id }));
        }
        setNewSprintName('');
        setShowAddSprint(false);
        showStatus('success', 'Tạo Sprint thành công!');
      }
    } catch (err) {
      console.error('Error creating sprint:', err);
      showStatus('error', err.response?.data?.message || 'Không thể tạo Sprint.');
    }
  };

  // Handle Create Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.sprintId) {
      showStatus('error', 'Vui lòng chọn hoặc tạo Sprint trước.');
      return;
    }
    if (!newTask.title.trim()) {
      showStatus('error', 'Vui lòng nhập tên Task.');
      return;
    }

    try {
      showStatus('loading', 'Đang thêm Task...');
      const response = await axios.post(API_BASE_URL, newTask, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setTasks((prev) => [response.data.task, ...prev]);
        setNewTask((prev) => ({
          ...prev,
          title: '',
          description: '',
          assigneeId: '',
        }));
        setShowAddTask(false);
        showStatus('success', 'Thêm Task thành công!');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      showStatus('error', err.response?.data?.message || 'Không thể thêm Task.');
    }
  };

  // Keep track of values on Focus to know if they changed on Blur
  const handleFocus = (taskId, field, value) => {
    if (!originalValues.current[taskId]) {
      originalValues.current[taskId] = {};
    }
    originalValues.current[taskId][field] = value;
  };

  // Autosave update function
  const saveField = async (taskId, field, value) => {
    // Check if value actually changed
    const originalVal = originalValues.current[taskId]?.[field];
    if (originalVal === value) return; // No change, do not save

    try {
      showStatus('loading', 'Đang tự động lưu...');
      const response = await axios.put(
        `${API_BASE_URL}/${taskId}`,
        { [field]: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? response.data.task : t))
        );
        showStatus('success', 'Đã tự động lưu thành công!');
        // Update local reference to new value
        if (originalValues.current[taskId]) {
          originalValues.current[taskId][field] = value;
        }
      }
    } catch (err) {
      console.error('Error autosaving task field:', err);
      showStatus('error', err.response?.data?.message || 'Lỗi khi tự động lưu.');
    }
  };

  // Filter tasks based on selected sprint and search query
  const filteredTasks = tasks.filter((task) => {
    const sprintMatch =
      selectedSprintFilter === 'all' || task.sprintId?._id === selectedSprintFilter;
    const searchMatch =
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assigneeId?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return sprintMatch && searchMatch;
  });

  return (
    <div className="tasks-dashboard">
      {/* Top bar */}
      <div className="topbar">
        <div>
          <h1>Sprint & Task Management</h1>
          <div className="sub">
            Quản lý và cập nhật tiến độ công việc theo Sprint
          </div>
        </div>

        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm task, mô tả, người thực hiện..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Quick Action Bar & Filter */}
      <div className="action-bar">
        <div className="filters-group">
          <label htmlFor="sprint-filter">Lọc theo Sprint:</label>
          <select
            id="sprint-filter"
            value={selectedSprintFilter}
            onChange={(e) => setSelectedSprintFilter(e.target.value)}
            className="styled-select"
          >
            <option value="all">Tất cả Sprint</option>
            {sprints.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="buttons-group">
          <button
            onClick={() => setShowAddSprint(!showAddSprint)}
            className="btn btn-secondary"
          >
            {showAddSprint ? 'Đóng' : '+ Tạo Sprint mới'}
          </button>
          <button
            onClick={() => setShowAddTask(!showAddTask)}
            className="btn btn-primary"
          >
            {showAddTask ? 'Đóng' : '+ Thêm Task mới'}
          </button>
        </div>
      </div>

      {/* Floating Status Notification */}
      {status.message && (
        <div className={`status-notification ${status.type}`}>
          {status.type === 'loading' && <span className="spinner"></span>}
          {status.message}
        </div>
      )}

      {/* Add Sprint Form */}
      {showAddSprint && (
        <div className="form-card glassmorphism animate-fade-in">
          <h3>Tạo Sprint Mới</h3>
          <form onSubmit={handleCreateSprint} className="inline-form">
            <input
              type="text"
              placeholder="Nhập tên Sprint (Ví dụ: Sprint 6)"
              value={newSprintName}
              onChange={(e) => setNewSprintName(e.target.value)}
              className="styled-input"
              required
            />
            <button type="submit" className="btn btn-primary">Tạo</button>
          </form>
        </div>
      )}

      {/* Add Task Form */}
      {showAddTask && (
        <div className="form-card glassmorphism animate-fade-in">
          <h3>Thêm Task Mới</h3>
          <form onSubmit={handleCreateTask} className="grid-form">
            <div className="form-field">
              <label>Sprint <span className="required">*</span></label>
              <select
                value={newTask.sprintId}
                onChange={(e) => setNewTask({ ...newTask, sprintId: e.target.value })}
                className="styled-input"
                required
              >
                <option value="" disabled>-- Chọn Sprint --</option>
                {sprints.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Tên Task <span className="required">*</span></label>
              <input
                type="text"
                placeholder="Nhập tên nhiệm vụ..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="styled-input"
                required
              />
            </div>

            <div className="form-field">
              <label>Mô Tả</label>
              <input
                type="text"
                placeholder="Mô tả ngắn về nhiệm vụ..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="styled-input"
              />
            </div>

            <div className="form-field">
              <label>Người Thực Hiện</label>
              <select
                value={newTask.assigneeId}
                onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
                className="styled-input"
              >
                <option value="">-- Chưa phân công --</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.role || 'Developer'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-submit">
              <button type="submit" className="btn btn-primary btn-full">Thêm</button>
            </div>
          </form>
        </div>
      )}

      {/* Main Table */}
      <div className="table-container glassmorphism">
        {loading ? (
          <div className="loading-state">
            <span className="spinner-large"></span>
            <p>Đang tải danh sách nhiệm vụ...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <p>Không tìm thấy nhiệm vụ nào.</p>
            {sprints.length === 0 && (
              <p className="hint">Mẹo: Hãy tạo Sprint mới trước, sau đó thêm Task vào Sprint đó.</p>
            )}
          </div>
        ) : (
          <table className="tasks-table">
            <thead>
              <tr>
                <th width="150">Sprint</th>
                <th width="60" style={{ textAlign: 'center' }}>STT</th>
                <th>Tên Task</th>
                <th>Mô Tả</th>
                <th width="200">Người Thực Hiện</th>
                <th width="120" style={{ fontSize: '11px', color: 'var(--muted)' }}>Cập nhật lần cuối</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, index) => (
                <tr key={task._id}>
                  {/* Column 1: Sprint Tag / Dropdown */}
                  <td>
                    <select
                      value={task.sprintId?._id || ''}
                      onChange={(e) => saveField(task._id, 'sprintId', e.target.value)}
                      className="table-select sprint-tag"
                    >
                      {sprints.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Column 2: STT */}
                  <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--muted)' }}>
                    {index + 1}
                  </td>

                  {/* Column 3: Tên Task (Title Input) */}
                  <td>
                    <input
                      type="text"
                      value={task.title}
                      onFocus={(e) => handleFocus(task._id, 'title', e.target.value)}
                      onBlur={(e) => saveField(task._id, 'title', e.target.value)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTasks((prev) =>
                          prev.map((t) => (t._id === task._id ? { ...t, title: val } : t))
                        );
                      }}
                      className="table-input task-title-input"
                    />
                  </td>

                  {/* Column 4: Mô Tả (Description Input) */}
                  <td>
                    <input
                      type="text"
                      value={task.description || ''}
                      placeholder="Thêm mô tả..."
                      onFocus={(e) => handleFocus(task._id, 'description', e.target.value)}
                      onBlur={(e) => saveField(task._id, 'description', e.target.value)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTasks((prev) =>
                          prev.map((t) => (t._id === task._id ? { ...t, description: val } : t))
                        );
                      }}
                      className="table-input"
                    />
                  </td>

                  {/* Column 5: Người Thực Hiện Dropdown */}
                  <td>
                    <select
                      value={task.assigneeId?._id || ''}
                      onChange={(e) => saveField(task._id, 'assigneeId', e.target.value)}
                      className="table-select"
                    >
                      <option value="">Chưa phân công</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} ({u.role || 'Dev'})
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Column 6: Updated info metadata */}
                  <td style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    <div>
                      {task.updatedAt
                        ? new Date(task.updatedAt).toLocaleDateString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </div>
                    {task.updatedBy?.name && (
                      <div className="updated-by-name">bởi {task.updatedBy.name}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
