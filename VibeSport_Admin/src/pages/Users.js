import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchUsers, 
  updateUserRole, 
  lockUnlockUser, 
  fetchUserReports, 
  resolveUserReports, 
  clearError 
} from '../redux/slices/adminUsersSlice';
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
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('newest');
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const loadData = useCallback((page = 1, search = '', status = 'all', sortBy = 'newest') => {
    dispatch(fetchUsers({ 
      page, 
      limit: 10, 
      search,
      status: status === 'reported' ? 'reported' : '',
      sortBy: sortBy === 'reportCount' ? 'reportCount' : ''
    }));
  }, [dispatch]);

  useEffect(() => {
    loadData(1, searchQuery, statusFilter, sortFilter);
    return () => dispatch(clearError());
  }, [loadData, dispatch, statusFilter, sortFilter]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    loadData(1, query, statusFilter, sortFilter);
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
      if (selectedUser && selectedUser._id === userId) {
        setSelectedUser(prev => ({ ...prev, isLocked: !isCurrentlyLocked }));
      }
    } else {
      showNotification(resultAction.payload || 'Lỗi thao tác', 'error');
    }
  };

  const handleOpenDetail = async (user) => {
    setSelectedUser(user);
    setShowDetailModal(true);
    setReportsLoading(true);
    try {
      const resultAction = await dispatch(fetchUserReports({ id: user._id }));
      if (fetchUserReports.fulfilled.match(resultAction)) {
        setReports(resultAction.payload.data);
      } else {
        showNotification(resultAction.payload || 'Không thể tải báo cáo', 'error');
      }
    } catch (err) {
      showNotification('Lỗi khi tải báo cáo', 'error');
    } finally {
      setReportsLoading(false);
    }
  };

  const handleResolveReports = async (userId) => {
    try {
      const resultAction = await dispatch(resolveUserReports({ id: userId }));
      if (resolveUserReports.fulfilled.match(resultAction)) {
        showNotification('Đã xử lý bỏ qua báo cáo thành công!');
        setShowDetailModal(false);
        loadData(pagination.page, searchQuery, statusFilter, sortFilter);
      } else {
        showNotification(resultAction.payload || 'Lỗi xử lý báo cáo', 'error');
      }
    } catch (err) {
      showNotification('Lỗi khi xử lý báo cáo', 'error');
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
              <th>Báo cáo</th>
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
                  {user.reportCount > 0 ? (
                    <span className="report-badge reported" onClick={() => handleOpenDetail(user)}>
                      {user.reportCount} report
                    </span>
                  ) : (
                    <span className="report-badge-zero">0</span>
                  )}
                </td>
                <td>
                  <span className={`status-badge ${user.isLocked ? 'status-locked' : 'status-active'}`}>
                    {user.isLocked ? 'Đã khóa' : 'Hoạt động'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons-cell">
                    <button 
                      className="action-btn detail-btn"
                      onClick={() => handleOpenDetail(user)}
                    >
                      Chi tiết
                    </button>
                    <button 
                      className={`action-btn ${user.isLocked ? 'unlock' : 'lock'}`}
                      onClick={() => handleLockToggle(user._id, user.isLocked)}
                    >
                      {user.isLocked ? 'Mở khóa' : 'Khóa'}
                    </button>
                  </div>
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
                onClick={() => loadData(pagination.page - 1, searchQuery, statusFilter, sortFilter)}
              >
                Trước
              </button>
              <button 
                className="page-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadData(pagination.page + 1, searchQuery, statusFilter, sortFilter)}
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

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Trạng thái:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="reported">Bị báo cáo</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sắp xếp:</label>
          <select value={sortFilter} onChange={(e) => setSortFilter(e.target.value)}>
            <option value="newest">Mới nhất</option>
            <option value="reportCount">Bị báo cáo nhiều nhất</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ color: '#ff3b30', background: 'rgba(255, 59, 48, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {renderContent()}

      {/* Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết người dùng</h3>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* User Identity */}
              <div className="detail-user-profile">
                <div className="detail-avatar">
                  {selectedUser.picture ? (
                    <img src={selectedUser.picture} alt="" />
                  ) : (
                    <div className="avatar-placeholder-large">
                      {(selectedUser.name || selectedUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="detail-info">
                  <div className="detail-name">{selectedUser.name || 'Chưa cập nhật'}</div>
                  <div className="detail-email">{selectedUser.email}</div>
                  <div className="detail-meta">
                    <p><strong>Ngày tham gia:</strong> {new Date(selectedUser.createdAt).toLocaleDateString('vi-VN')}</p>
                    <p><strong>Vai trò:</strong> {selectedUser.role}</p>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="detail-section">
                <label>Trạng thái tài khoản:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '8px' }}>
                  <span className={`status-badge ${selectedUser.isLocked ? 'status-locked' : 'status-active'}`}>
                    {selectedUser.isLocked ? 'Đã khóa' : 'Đang hoạt động'}
                  </span>
                  <button 
                    className={`action-btn ${selectedUser.isLocked ? 'unlock' : 'lock'}`}
                    onClick={() => handleLockToggle(selectedUser._id, selectedUser.isLocked)}
                  >
                    {selectedUser.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                  </button>
                </div>
              </div>

              {/* Reports Section */}
              <div className="detail-section">
                <label>Lịch sử báo cáo vi phạm ({selectedUser.reportCount || 0} lượt):</label>
                {reportsLoading ? (
                  <div className="modal-loading">Đang tải lịch sử báo cáo...</div>
                ) : reports.length > 0 ? (
                  <div className="report-history-list">
                    {reports.map((report) => (
                      <div key={report._id} className="report-item">
                        <div className="report-item-header">
                          <div className="report-reporter">
                            {report.reporterId?.picture ? (
                              <img src={report.reporterId.picture} alt="" className="avatar-xs" />
                            ) : (
                              <div className="avatar-xs avatar-placeholder">
                                {(report.reporterId?.name || report.reporterId?.email || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <span className="reporter-name">
                              {report.reporterId?.name || report.reporterId?.email || 'Người dùng ẩn danh'}
                            </span>
                          </div>
                          <span className="report-time">
                            {new Date(report.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <div className="report-reason-content">
                          <strong>Lý do báo cáo:</strong> {report.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-reports-msg">Chưa có báo cáo vi phạm nào hoặc các báo cáo đã được xử lý.</div>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              {selectedUser.reportCount > 0 && (
                <button 
                  className="btn btn-resolve"
                  onClick={() => handleResolveReports(selectedUser._id)}
                >
                  Bỏ qua báo cáo (Duyệt/Đã xử lý)
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className={`status-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}
