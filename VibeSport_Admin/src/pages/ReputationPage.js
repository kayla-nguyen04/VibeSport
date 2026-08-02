import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import './ReputationPage.css';

export default function ReputationPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'warning' | 'locked' | 'good'
  const [selectedUser, setSelectedUser] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const fetchReputationData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get('http://localhost:4000/api/ratings/admin/list', {
        params: { search: searchQuery.trim() || undefined },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.data?.success) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      console.error('Fetch reputation error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchReputationData();
  }, [fetchReputationData]);

  const handleOpenHistory = (user) => {
    setSelectedUser(user);
    setShowHistoryModal(true);
  };

  // Tính toán thống kê
  const totalCount = users.length;
  const lockedCount = users.filter((u) => u.isLocked || (u.rating || 5) < 2.0).length;
  const warningCount = users.filter((u) => (u.rating || 5) < 3.0 && (u.rating || 5) >= 2.0).length;
  const goodCount = users.filter((u) => (u.rating || 5) >= 4.5).length;

  // Lọc người dùng theo Tab
  const filteredUsers = users.filter((u) => {
    const rate = u.rating || 5.0;
    if (activeFilter === 'locked') return u.isLocked || rate < 2.0;
    if (activeFilter === 'warning') return rate < 3.0 && rate >= 2.0;
    if (activeFilter === 'good') return rate >= 4.5;
    return true;
  });

  const renderStars = (stars) => {
    const s = Math.round(stars || 5);
    return '⭐'.repeat(s);
  };

  return (
    <div className="reputation-page">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">⭐ Quản lý Đánh giá & Uy tín Người dùng</h1>
          <p className="page-subtitle">
            Theo dõi danh sách người dùng, điểm sao trung bình và lịch sử các lượt đánh giá nhận được trong hệ thống
          </p>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div>
            <span className="stat-num">{totalCount}</span>
            <span className="stat-label">Tổng người dùng</span>
          </div>
        </div>

        <div className="stat-card good">
          <span className="stat-icon">🌟</span>
          <div>
            <span className="stat-num">{goodCount}</span>
            <span className="stat-label">Uy tín cao (≥ 4.5⭐)</span>
          </div>
        </div>

        <div className="stat-card warning">
          <span className="stat-icon">⚠️</span>
          <div>
            <span className="stat-num">{warningCount}</span>
            <span className="stat-label">Cảnh báo sao (&lt; 3.0⭐)</span>
          </div>
        </div>

        <div className="stat-card danger">
          <span className="stat-icon">⛔</span>
          <div>
            <span className="stat-num">{lockedCount}</span>
            <span className="stat-label">Đã bị khóa (&lt; 2.0⭐)</span>
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="filter-card">
        <div className="filter-tabs">
          <button
            className={`tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Tất cả ({totalCount})
          </button>
          <button
            className={`tab-btn ${activeFilter === 'good' ? 'active' : ''}`}
            onClick={() => setActiveFilter('good')}
          >
            🌟 Uy tín cao ({goodCount})
          </button>
          <button
            className={`tab-btn ${activeFilter === 'warning' ? 'active' : ''}`}
            onClick={() => setActiveFilter('warning')}
          >
            ⚠️ Cảnh báo (&lt; 3.0⭐) ({warningCount})
          </button>
          <button
            className={`tab-btn ${activeFilter === 'locked' ? 'active' : ''}`}
            onClick={() => setActiveFilter('locked')}
          >
            ⛔ Đã bị khóa (&lt; 2.0⭐) ({lockedCount})
          </button>
        </div>

        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm người dùng theo tên, email, sđt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* USER LIST GRID */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Đang tải dữ liệu uy tín người dùng...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">⭐</span>
          <h3 className="empty-title">Không tìm thấy người dùng nào</h3>
          <p className="empty-subtitle">Chưa có dữ liệu người dùng phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="users-reputation-grid">
          {filteredUsers.map((userItem) => {
            const avgStar = Number(userItem.rating || 5.0);
            const isLocked = userItem.isLocked || avgStar < 2.0;
            const isWarning = avgStar < 3.0 && !isLocked;
            const historyList = userItem.receivedRatings || [];

            return (
              <div key={userItem._id} className={`user-rep-card ${isLocked ? 'is-locked-card' : ''}`}>
                <div className="user-rep-header">
                  <div className="user-avatar-wrap">
                    {userItem.avatar || userItem.picture ? (
                      <img src={userItem.avatar || userItem.picture} alt={userItem.name} className="user-avatar-img" />
                    ) : (
                      <div className="user-avatar-fallback">
                        {(userItem.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="user-info-body">
                    <h3 className="user-name">{userItem.name || 'Người dùng'}</h3>
                    <p className="user-contact-text">📧 {userItem.email || 'Chưa có email'}</p>
                    <p className="user-contact-text">📞 {userItem.phone || 'Chưa có SĐT'}</p>
                  </div>
                </div>

                <div className="user-rep-rating-box">
                  <div className="rating-score-row">
                    <span className="score-big">{avgStar.toFixed(1)}</span>
                    <div className="stars-wrap">
                      <span className="stars-render">{renderStars(avgStar)}</span>
                      <span className="reviews-count-text">
                        ({historyList.length} lượt đánh giá)
                      </span>
                    </div>
                  </div>

                  {/* Badges Trạng thái */}
                  <div className="status-badge-container">
                    {isLocked ? (
                      <span className="status-badge locked">⛔ Tài khoản đã bị khóa (&lt; 2.0⭐)</span>
                    ) : isWarning ? (
                      <span className="status-badge warning">⚠️ Cảnh báo sao thấp (&lt; 3.0⭐)</span>
                    ) : (
                      <span className="status-badge active">🟢 Hoạt động tốt</span>
                    )}
                  </div>
                </div>

                {/* THAO TÁC XEM LỊCH SỬ BỊ ĐÁNH GIÁ */}
                <div className="user-card-footer">
                  <button className="btn-view-history" onClick={() => handleOpenHistory(userItem)}>
                    📜 Xem lịch sử bị đánh giá ({historyList.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL LỊCH SỬ BỊ ĐÁNH GIÁ */}
      {showHistoryModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex-align-center gap-12">
                <h2>📜 Lịch sử bị đánh giá của {selectedUser.name}</h2>
                <span className="modal-star-pill">
                  ⭐ {(selectedUser.rating || 5.0).toFixed(1)} / 5.0
                </span>
              </div>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              {!selectedUser.receivedRatings || selectedUser.receivedRatings.length === 0 ? (
                <div className="empty-history">
                  <span className="empty-icon">📝</span>
                  <p>Người dùng này chưa nhận được lượt đánh giá nào từ các bạn chơi khác.</p>
                </div>
              ) : (
                <div className="history-list">
                  {selectedUser.receivedRatings.map((item, idx) => {
                    const reviewer = item.fromUser || {};
                    const match = item.matchId || {};

                    return (
                      <div key={item._id || idx} className="history-item-card">
                        <div className="history-item-top">
                          <div className="reviewer-info">
                            <div className="reviewer-avatar">
                              {reviewer.avatar || reviewer.picture ? (
                                <img src={reviewer.avatar || reviewer.picture} alt="rev" />
                              ) : (
                                <span>{(reviewer.name || 'U').charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <span className="reviewer-name">{reviewer.name || 'Bạn đấu'}</span>
                              <span className="reviewer-email">{reviewer.email || ''}</span>
                            </div>
                          </div>

                          <div className="stars-given">
                            <span className="stars-gold">{renderStars(item.stars)}</span>
                            <span className="stars-num">({item.stars} ⭐)</span>
                          </div>
                        </div>

                        {item.comment ? (
                          <div className="review-comment-box">
                            💬 "{item.comment}"
                          </div>
                        ) : (
                          <p className="no-comment-text">(Không có lời nhận xét)</p>
                        )}

                        {match && match.title && (
                          <div className="match-meta-box">
                            <span>⚽ <strong>Trận đấu:</strong> {match.title}</span>
                            {match.date && <span>📅 Ngày: {match.date}</span>}
                            {match.locationName && <span>📍 Sân: {match.locationName}</span>}
                          </div>
                        )}

                        <div className="review-time">
                          🕒 Đã đánh giá lúc: {new Date(item.createdAt || Date.now()).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowHistoryModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
