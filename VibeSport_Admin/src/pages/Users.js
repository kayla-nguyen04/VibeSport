import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUsers, updateUserRole, lockUnlockUser, clearError } from '../redux/slices/adminUsersSlice';
import './Users.css';

const ROLES = [
  { value: 'Admin', label: 'Admin' },
  { value: 'User', label: 'Users' }
];

export default function Users() {
  const dispatch = useDispatch();
  const { users, pagination, loading, error } = useSelector((state) => state.adminUsers);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);

  const loadData = useCallback((page = 1, search = '') => {
    dispatch(fetchUsers({ page, limit: 10, search }));
  }, [dispatch]);

  useEffect(() => {
    loadData();
    return () => dispatch(clearError());
  }, [loadData, dispatch]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    loadData(1, query); // Thường nên dùng debounce, nhưng ở đây có thể gọi luôn cho đơn giản
  };

  const handleRoleChange = async (userId, newRole) => {
    const resultAction = await dispatch(updateUserRole({ id: userId, role: newRole }));
    if (updateUserRole.fulfilled.match(resultAction)) {
      showNotification('Cập nhật quyền thành công!');
    } else {
      showNotification(resultAction.payload || 'Lỗi cập nhật', 'error');
    }
  };

  const handleLockToggle = async (userId, isCurrentlyLocked) => {
    const resultAction = await dispatch(lockUnlockUser({ id: userId, isLocked: !isCurrentlyLocked }));
    if (lockUnlockUser.fulfilled.match(resultAction)) {
      showNotification(!isCurrentlyLocked ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
    } else {
      showNotification(resultAction.payload || 'Lỗi thao tác', 'error');
    }
  };

  const renderContent = () => {
    if (loading && users.length === 0) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <div className="empty-state">
          <p>Không có người dùng nào được tìm thấy</p>
        </div>
      );
    }

    return (
      <div className="table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Ngày tham gia</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td>
                  <div className="user-info">
                    <div className="user-avatar">
                      {user.picture ? (
                        <img src={user.picture} alt={user.name || 'User'} />
                      ) : (
                        (user.name || user.email || 'U')[0].toUpperCase()
                      )}
                    </div>
                    <div className="user-details">
                      <span className="user-name">{user.name || 'Chưa cập nhật'}</span>
                      <span className="user-email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                <td>
                  <select 
                    className="table-select"
                    value={user.role}
                    onChange={(e) => handleRoleChange(user._id, e.target.value)}
                  >
                    {ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`status-badge ${user.isLocked ? 'status-locked' : 'status-active'}`}>
                    {user.isLocked ? 'Đã khóa' : 'Hoạt động'}
                  </span>
                </td>
                <td>
                  <button 
                    className={`action-btn ${user.isLocked ? 'unlock' : 'lock'}`}
                    onClick={() => handleLockToggle(user._id, user.isLocked)}
                  >
                    {user.isLocked ? 'Mở khóa' : 'Khóa'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Hiển thị trang {pagination.page} / {pagination.totalPages} ({pagination.total} tài khoản)
            </span>
            <div className="pagination-controls">
              <button 
                className="page-btn"
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1, searchQuery)}
              >
                Trước
              </button>
              <button 
                className="page-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadData(pagination.page + 1, searchQuery)}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="users-dashboard">
      <div className="topbar">
        <div>
          <h1>Quản lý Người dùng</h1>
          <div className="sub">Xem, phân quyền và khóa tài khoản người dùng trên hệ thống</div>
        </div>
        
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input 
            type="text" 
            placeholder="Tìm theo tên hoặc email..." 
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: '#ff3b30', background: 'rgba(255, 59, 48, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {renderContent()}

      {notification && (
        <div className={`status-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}
