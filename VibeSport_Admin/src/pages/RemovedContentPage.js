import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import './RemovedContentPage.css';

const CATEGORY_LABELS = {
  spam: 'Spam',
  'ngôn từ thù ghét': 'Ngôn từ thù ghét',
  'nội dung không phù hợp': 'Nội dung không phù hợp',
  'vi phạm bản quyền': 'Vi phạm bản quyền',
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
  if (!text) return '(Không có nội dung)';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

export default function RemovedContentPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const [filterCategory, setFilterCategory] = useState('all');
  const [confirmRestore, setConfirmRestore] = useState(null); // post đang confirm restore
  const [restoring, setRestoring] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const fetchRemovedPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: 'removed_by_admin',
      };
      const res = await api.get('/posts', { params });
      if (res.data.success) {
        // Filter by category if needed (client-side filter for simplicity)
        let data = res.data.data;
        if (filterCategory !== 'all') {
          data = data.filter(p => p.removalCategory === filterCategory);
        }
        setPosts(data);
        setPagination(res.data.pagination);
      } else {
        setError(res.data.message || 'Lấy danh sách thất bại');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải danh sách');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, filterCategory]);

  useEffect(() => {
    fetchRemovedPosts();
  }, [fetchRemovedPosts]);

  const handleCategoryChange = (cat) => {
    setFilterCategory(cat);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setPagination(p => ({ ...p, page: newPage }));
  };

  const handleRestore = async (post) => {
    try {
      setRestoring(true);
      const res = await api.patch(`/posts/${post._id}/restore`);
      if (res.data.success) {
        showToast('Đã khôi phục bài viết thành công');
        setConfirmRestore(null);
        // Refresh list - bài viết sẽ biến mất vì không còn removed
        fetchRemovedPosts();
      } else {
        showToast(res.data.message || 'Khôi phục thất bại', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Lỗi khi khôi phục bài viết', 'error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="removed-page">
      {/* Toast */}
      {toast.show && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Nội dung đã xóa</h1>
          <p className="page-sub">Danh sách các bài viết đã bị gỡ bởi quản trị viên</p>
        </div>
        <button className="refresh-btn" onClick={fetchRemovedPosts} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Danh mục vi phạm:</label>
          <select value={filterCategory} onChange={(e) => handleCategoryChange(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="spam">Spam</option>
            <option value="ngôn từ thù ghét">Ngôn từ thù ghét</option>
            <option value="nội dung không phù hợp">Nội dung không phù hợp</option>
            <option value="vi phạm bản quyền">Vi phạm bản quyền</option>
            <option value="other">Khác</option>
          </select>
        </div>

        <div className="total-count">
          Tổng: <strong>{pagination.total}</strong> bài viết đã gỡ
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
            <button onClick={fetchRemovedPosts}>Thử lại</button>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" strokeWidth="1.5">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
            <p>Không có bài viết nào bị gỡ</p>
          </div>
        ) : (
          <>
            <table className="removed-table">
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Tác giả</th>
                  <th>Lý do gỡ</th>
                  <th>Danh mục</th>
                  <th>Admin gỡ</th>
                  <th>Ngày gỡ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post._id}>
                    <td className="content-cell">
                      <div className="post-preview">
                        {post.mediaUrls?.length > 0 && (
                          <img src={post.mediaUrls[0]} alt="" className="post-thumb" />
                        )}
                        <span>{truncateText(post.content)}</span>
                      </div>
                    </td>
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
                    <td className="reason-cell">
                      <span className="reason-text" title={post.removalReason}>
                        {post.removalReason || '-'}
                      </span>
                    </td>
                    <td>
                      <span className="category-badge">
                        {CATEGORY_LABELS[post.removalCategory] || post.removalCategory || '-'}
                      </span>
                    </td>
                    <td className="admin-cell">
                      {post.removedBy?.name || 'Admin'}
                    </td>
                    <td className="date-cell">{formatDate(post.removedAt)}</td>
                    <td>
                      <button
                        className="restore-btn"
                        onClick={() => setConfirmRestore(post)}
                      >
                        Khôi phục
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

      {/* Confirm Restore Modal */}
      {confirmRestore && (
        <div className="modal-overlay" onClick={() => !restoring && setConfirmRestore(null)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Xác nhận khôi phục</h3>
              <button className="close-btn" onClick={() => setConfirmRestore(null)} disabled={restoring}>×</button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                Bạn chắc chắn muốn khôi phục bài viết này? Bài viết sẽ được hiển thị lại cho người dùng.
              </p>
              <div className="confirm-preview">
                <div className="preview-content">
                  <strong>Nội dung:</strong> {truncateText(confirmRestore.content, 60)}
                </div>
                <div className="preview-reason">
                  <strong>Đã gỡ vì:</strong> {CATEGORY_LABELS[confirmRestore.removalCategory] || confirmRestore.removalCategory} : {confirmRestore.removalReason}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="restore-confirm-btn" onClick={() => handleRestore(confirmRestore)} disabled={restoring}>
                {restoring ? 'Đang khôi phục...' : 'Xác nhận khôi phục'}
              </button>
              <button className="cancel-btn" onClick={() => setConfirmRestore(null)} disabled={restoring}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
