import React, { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/slices/authSlice';
import './MainLayout.css';

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),

  growth: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-6 4 3 5-8" />
    </svg>
  ),

  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21a8 8 0 10-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),

  posts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  ),

  reputation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),

  calls: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4l2.5 2.5" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),

  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),

  deleted: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  ),

  support: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.4 8.4 0 01-9 8.4A8.4 8.4 0 013 11.5a8.4 8.4 0 019-8.4 8.4 8.4 0 019 8.4z" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
};

const navGroups = [
      {
        label: 'Tổng quan',
        items: [
          { key: '/growth', icon: icons.growth, label: 'Thống kê tăng trưởng' },
        ],
      },
  {
    label: 'Quản lý',
    items: [
      { key: '/users', icon: icons.users, label: 'Người dùng' },
      { key: '/posts', icon: icons.posts, label: 'Bài viết' },
      { key: '/reputation', icon: icons.reputation, label: 'Đánh giá & uy tín' },
    ],
  },
  {
    label: 'Kiểm duyệt',
    items: [
      { key: '/reports', icon: icons.reports, label: 'Báo cáo vi phạm' },
      { key: '/deleted-content', icon: icons.deleted, label: 'Nội dung đã xóa' },
    ],
  },
  {
    label: 'Khác',
    items: [
      { key: '/support', icon: icons.support, label: 'Chat hỗ trợ' },
    ],
  },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const initials = (user?.name || 'Admin')
    .split(' ')
    .map((i) => i[0])
    .join('')
    .toUpperCase();

  return (
    <div className="dash-shell">
      <aside className="sidebar">

        <div className="logo-mark">
          <img
            src="/logoVibe.png"
            alt="VibeSport"
            className="sidebar-logo"
          />
        </div>

        <div className="sidebar-nav">
          {navGroups.map((group) => (
            <React.Fragment key={group.label}>
              <div className="nav-group-label">{group.label}</div>

              {group.items.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.key}
                  end={item.key === '/'}
                  className={({ isActive }) =>
                    `nav-item${isActive ? ' active' : ''}`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="sidebar-foot">

          <button
            className="sidebar-foot-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="avatar">{initials}</div>

            <div>
              <div className="who">{user?.name || 'Admin'}</div>
              <div className="role">Quản trị viên</div>
            </div>
          </button>

          {menuOpen && (
            <div className="logout-menu">
              <button onClick={handleLogout}>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}