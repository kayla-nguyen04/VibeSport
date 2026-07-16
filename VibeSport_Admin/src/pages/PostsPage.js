import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import './PostsPage.css';

const STATUS_LABELS = {
  active: 'Hoạt động',
  removed_by_admin: 'Đã gỡ',
  reported: 'Bị báo cáo',
  pending_review: 'Chờ duyệt',
  hidden: 'Ẩn',
};

const STATUS_CLASSES = {
  active: 'status-active',
  removed_by_admin: 'status-removed',
  reported: 'status-reported',
  pending_review: 'status-pending',
  hidden: 'status-hidden',
};

const CATEGORY_LABELS = {
  spam: 'Spam',
  'ngôn từ thù ghét': 'Ngôn từ thù ghét',
  'nội dung không phù hợp': 'Nội dung không phù hợp',
  'vi phạm bản quyền': 'Vi ph� thuờn quyền',
  other: 'Khác',
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateText(text, maxLength = 80) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Resolve media URL — nếu là relative path thì ghép với API base URL
const API_IMG_BASE = 'http://localhost:4000';
function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_IMG_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function PostsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState('desc');

  const [selectedPost, setSelectedPost] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [removeCategory, setRemoveCategory] = useState('spam');
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: filterStatus,
        sortBy,
        order,
      };
      const res = await api.get('/posts', { params });
      if (res.data.success) {
        setPosts(res.data.data);
        setPagination(res.data.pagination);
      } else {
        setError(res.data.message || 'Lấy danh sách bài viết thất bại');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải danh sách bài viết');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, filterStatus, sortBy, order]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleFilterChange = (newStatus) => {
    setFilterStatus(newStatus);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(p => ({ ...p, page: newPage }));
  };

  const openDetail = async (post) => {
    try {
      const res = await api.get(`/posts/${post._id}`);
      if (res.data.success) {
        setSelectedPost(res.data.data);
        setShowDetailModal(true);
      }
    } catch (err) {
      // 401 → token hết hạn, chuyển hướng login
      if (err.response?.status === 401) {
        localStorage.removeItem('adminToken');
        window.location.href = '/login';
        return;
      }
      showToast(err.response?.data?.message || 'Không thể tải chi tiết bài viết', 'error');
    }
  };

  const openRemoveModal = () => {
    setRemoveReason('');
    setRemoveCategory('spam');
    setShowRemoveModal(true);
  };

  const handleRemovePost = async () => {
    if (!removeReason.trim()) {
      showToast('Vui lòng nhập lý do gỡ bài viết', 'error');
      return;
    }
    try {
      setRemoving(true);
      const res = await api.patch(`/posts/${selectedPost._id}/violation`, {
        reason: removeReason,
        category: removeCategory,
      });
      if (res.data.success) {
        showToast('Đã gỡ bài viết thành công');
        setShowRemoveModal(false);
        setShowDetailModal(false);
        fetchPosts();
      } else {
        showToast(res.data.message || 'Gỡ bài viết thất bại', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi khi gỡ bài viết', 'error');
    } finally {
      setRemoving(false);
    }
  };

  const getBadgeClass = (post) => {
    if (post.status === 'active' && post.hasPendingReports) return 'status-reported';
    if (post.status === 'pending_review') return 'status-pending';
    return STATUS_CLASSES[post.status] || 'status-active';
  };

  return (
    <div className="posts-page">
      {/* Toast */}
      {toast.show && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Bài viết</h1>
          <p className="page-sub">Quản lý và kiểm duyệt nội dung bài viết trên hệ thống</p>
        </div>
        <button className="refresh-btn" onClick={fetchPosts} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Trạng thái:</label>
          <select value={filterStatus} onChange={(e) => handleFilterChange(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="reported">Bị báo cáo</option>
            <option value="pending_review">Chờ duyệt</option>
            <option value="removed_by_admin">Đã gỡ</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sắp xếp:</label>
          <select value={sortBy} onChange={(e) => handleSortChange(e.target.value)}>
            <option value="createdAt">Mới nhất</option>
            <option value="reportCount">Report nhiều nhất</option>
            <option value="likesCount">Nhiều lượt thích</option>
            <option value="commentsCount">Nhiều bình luận</option>
          </select>
        </div>

        {filterStatus !== 'all' && filterStatus !== 'active' && (
          <div className="filter-group">
            <label>Thứ tự:</label>
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="desc">Giảm dần</option>
              <option value="asc">Tăng dần</option>
            </select>
          </div>
        )}

        <div className="total-count">
          Tổng: <strong>{pagination.total}</strong> bài viết
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={fetchPosts}>Thử lại</button>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" strokeWidth="1.5">
              <path d="M4 4h16v16H4z" />
              <path d="M8 9h8M8 13h5" />
            </svg>
            <p>Không có bài viết nào</p>
          </div>
        ) : (
          <>
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Tác giả</th>
                  <th>Nội dung</th>
                  <th>Report</th>
                  <th>Trạng thái</th>
                  <th>Ngày đăng</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post._id}>
                    <td>
                      <div className="author-cell">
                        {post.userId?.picture ? (
                          <img src={post.userId.picture} alt="" className="avatar-sm" />
                        ) : (
                          <div className="avatar-sm avatar-placeholder">
                            {post.userId?.name?.[0] || '?'}
                          </div>
                        )}
                        <span className="author-name">{post.userId?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="content-cell">
                      <span className="content-text">{truncateText(post.content, 55)}</span>
                    </td>
                    <td className="report-cell">
                      {post.reportCount > 0 ? (
                        <span className="report-badge">{post.reportCount}</span>
                      ) : (
                        <span className="report-zero">0</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${getBadgeClass(post)}`}>
                        {post.status === 'active' && post.hasPendingReports
                          ? 'Bị báo cáo'
                          : STATUS_LABELS[post.status] || post.status}
                      </span>
                    </td>
                    <td className="date-cell">{formatDate(post.createdAt)}</td>
                    <td>
                      <button className="action-btn detail-btn" onClick={() => openDetail(post)}>
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="page-btn"
                  disabled={pagination.page === 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  ‹ Trước
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      className={`page-btn ${pagination.page === pageNum ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  className="page-btn"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Sau ›
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết bài viết</h3>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Author */}
              <div className="detail-author">
                {selectedPost.userId?.picture ? (
                  <img src={selectedPost.userId.picture} alt="" className="avatar-md" />
                ) : (
                  <div className="avatar-md avatar-placeholder">
                    {selectedPost.userId?.name?.[0] || '?'}
                  </div>
                )}
                <div>
                  <div className="detail-author-name">{selectedPost.userId?.name || 'N/A'}</div>
                  <div className="detail-author-email">{selectedPost.userId?.email || ''}</div>
                </div>
              </div>

              {/* Content */}
              <div className="detail-section">
                <label>Nội dung:</label>
                <div className="detail-content">{selectedPost.content || '(Không có nội dung)'}</div>
              </div>

              {/* Media */}
              {selectedPost.mediaUrls?.length > 0 && (
                <div className="detail-section">
                  <label>Media ({selectedPost.mediaUrls.length} ảnh):</label>
                  <div className="detail-media">
                    {selectedPost.mediaUrls.map((url, i) => (
                      <img key={i} src={resolveMediaUrl(url)} alt="" className="media-thumb" />
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="detail-stats">
                <div className="stat-item">
                  <span className="stat-label">Lượt thích</span>
                  <span className="stat-value">{selectedPost.likesCount || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Bình luận</span>
                  <span className="stat-value">{selectedPost.commentsCount || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Report</span>
                  <span className="stat-value report-value">{selectedPost.reportCount || 0}</span>
                </div>
              </div>

              {/* Moderation info */}
              {selectedPost.status === 'removed_by_admin' && (
                <div className="detail-section removal-info">
                  <label>Thông tin gỡ bài:</label>
                  <div className="removal-details">
                    <p><strong>Lý do:</strong> {selectedPost.removalReason}</p>
                    <p><strong>Danh mục:</strong> {CATEGORY_LABELS[selectedPost.removalCategory] || selectedPost.removalCategory}</p>
                    <p><strong>Admin:</strong> {selectedPost.removedBy?.name || 'N/A'}</p>
                    <p><strong>Ngày gỡ:</strong> {formatDate(selectedPost.removedAt)}</p>
                  </div>
                </div>
              )}

              {/* Report history */}
              {selectedPost.recentReports && selectedPost.recentReports.length > 0 && (
                <div className="detail-section">
                  <label>Lịch sử báo cáo ({selectedPost.recentReports.length} lượt):</label>
                  <div className="report-history">
                    {selectedPost.recentReports.map((report) => (
                      <div key={report._id} className="report-item">
                        <div className="report-item-header">
                          <div className="report-reporter">
                            {report.reporterId?.picture ? (
                              <img src={report.reporterId.picture} alt="" className="avatar-xs" />
                            ) : (
                              <div className="avatar-xs avatar-placeholder">
                                {report.reporterId?.name?.[0] || '?'}
                              </div>
                            )}
                            <span className="reporter-name">{report.reporterId?.name || 'N/A'}</span>
                          </div>
                          <span className="report-time">
                            {report.createdAt
                              ? new Date(report.createdAt).toLocaleString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </span>
                        </div>
                        <div className="report-reason">
                          <span className="reason-label">Lý do:</span>{' '}
                          <span className="reason-text">
                            {CATEGORY_LABELS[report.reason] || report.reason || 'Không rõ'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation logs */}
              {selectedPost.moderationLogs?.length > 0 && (
                <div className="detail-section">
                  <label>Lịch sử kiểm duyệt:</label>
                  <div className="moderation-logs">
                    {selectedPost.moderationLogs.map((log) => (
                      <div key={log._id} className="log-item">
                        <span className="log-action">{log.action === 'removed' ? 'Gỡ bài' : 'Khôi phục'}</span>
                        <span className="log-reason">{log.reason}</span>
                        <span className="log-date">{formatDate(log.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedPost.status !== 'removed_by_admin' && (
                <button className="remove-btn" onClick={openRemoveModal}>
                  Gỡ bài viết
                </button>
              )}
              <button className="cancel-btn" onClick={() => setShowDetailModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Modal */}
      {showRemoveModal && selectedPost && (
        <div className="modal-overlay" onClick={() => setShowRemoveModal(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Gỡ bài viết</h3>
              <button className="close-btn" onClick={() => setShowRemoveModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Danh mục vi phạm:</label>
                <select value={removeCategory} onChange={(e) => setRemoveCategory(e.target.value)}>
                  <option value="spam">Spam</option>
                  <option value="ngôn từ thù ghét">Ngôn từ thù ghét</option>
                  <option value="nội dung không phù hợp">Nội dung không phù hợp</option>
                  <option value="vi phạm bản quyền">Vi phạm bản quyền</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div className="form-group">
                <label>Lý do gỡ bài viết:</label>
                <textarea
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="remove-btn" onClick={handleRemovePost} disabled={removing}>
                {removing ? 'Đang xử lý...' : 'Xác nhận gỡ'}
              </button>
              <button className="cancel-btn" onClick={() => setShowRemoveModal(false)} disabled={removing}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
