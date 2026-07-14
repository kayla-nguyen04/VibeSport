import React, { useState } from 'react';
import './Dashboard.css';

const Dashboard = () => {
  const [search, setSearch] = useState('');

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Bảng điều khiển</h1>
          <div className="sub">
            Chào mừng đến hệ thống quản trị VibeSport
          </div>
        </div>

        <div className="search-box">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>

          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="panel"></div>
    </>
  );
};

export default Dashboard;