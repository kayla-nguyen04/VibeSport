import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import './Growth.css';

const API_GROWTH_URL = 'http://localhost:4000/api/admin/growth';

export default function Growth() {
  const { token } = useSelector((state) => state.auth);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tooltip interactive state
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const fetchGrowthData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(API_GROWTH_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setData(response.data);
      } else {
        setError(response.data.message || 'Lấy dữ liệu thất bại.');
      }
    } catch (err) {
      console.error('Error fetching growth data:', err);
      setError(err.response?.data?.message || 'Không thể tải dữ liệu thống kê tăng trưởng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchGrowthData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="growth-loading-container">
        <div className="growth-spinner"></div>
        <p>Đang tải dữ liệu thống kê tăng trưởng...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="growth-error-container">
        <div className="growth-error-card">
          <h3>Đã xảy ra lỗi</h3>
          <p>{error}</p>
          <button className="growth-retry-btn" onClick={fetchGrowthData}>Thử lại</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, rolesDistribution, providersDistribution, timeline } = data;

  // --- Calculations for SVG Line Chart (Users) ---
  const chartWidth = 600;
  const chartHeight = 240;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const maxUsersVal = Math.max(...timeline.map((d) => d.newUsers), 5);
  const userPoints = timeline.map((day, idx) => {
    const x = paddingLeft + (idx * plotWidth) / (timeline.length - 1);
    const y = paddingTop + plotHeight - (day.newUsers / maxUsersVal) * plotHeight;
    return { x, y, value: day.newUsers, date: day.date };
  });

  // Construct standard polyline & area path
  const linePath = userPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = userPoints.length > 0 
    ? `${linePath} L ${userPoints[userPoints.length - 1].x} ${paddingTop + plotHeight} L ${userPoints[0].x} ${paddingTop + plotHeight} Z`
    : '';

  // --- Calculations for SVG Bar Chart (Posts vs Messages) ---
  const maxActivityVal = Math.max(
    ...timeline.map((d) => Math.max(d.newPosts, d.newMessages)),
    10
  );

  const barChartWidth = 600;
  const barChartHeight = 240;
  const barPaddingLeft = 45;
  const barPaddingRight = 20;
  const barPaddingTop = 25;
  const barPaddingBottom = 40;

  const barPlotWidth = barChartWidth - barPaddingLeft - barPaddingRight;
  const barPlotHeight = barChartHeight - barPaddingTop - barPaddingBottom;

  const numDays = timeline.length;
  const groupWidth = barPlotWidth / numDays;
  const barWidth = groupWidth * 0.3; // Width of single bar

  return (
    <div className="growth-dashboard-container">
      {/* Header */}
      <div className="growth-header">
        <div>
          <h2>Thống kê độ tăng trưởng</h2>
          <p className="growth-subtitle">Theo dõi và phân tích sự phát triển của hệ thống VibeSport</p>
        </div>
        <button className="growth-refresh-btn" onClick={fetchGrowthData}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="growth-kpi-grid">
        <div className="growth-kpi-card">
          <div className="kpi-icon-wrapper users-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Tổng thành viên</span>
            <h3 className="kpi-value">{totals.users}</h3>
            <span className="kpi-trend positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              12.4% tuần này
            </span>
          </div>
        </div>

        <div className="growth-kpi-card">
          <div className="kpi-icon-wrapper posts-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Tổng bài viết</span>
            <h3 className="kpi-value">{totals.posts}</h3>
            <span className="kpi-trend positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              8.2% tuần này
            </span>
          </div>
        </div>

        <div className="growth-kpi-card">
          <div className="kpi-icon-wrapper teams-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Số lượng đội bóng</span>
            <h3 className="kpi-value">{totals.teams}</h3>
            <span className="kpi-trend positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              5.0% tuần này
            </span>
          </div>
        </div>

        <div className="growth-kpi-card">
          <div className="kpi-icon-wrapper matches-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M6.2 6.2L17.8 17.8" />
              <path d="M2 12h20" />
              <path d="M12 2v20" />
              <path d="M17.8 6.2L6.2 17.8" />
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Tổng số trận đấu</span>
            <h3 className="kpi-value">{totals.matches}</h3>
            <span className="kpi-trend positive">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              15.2% tuần này
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="growth-charts-grid">
        {/* Users Growth Line Chart */}
        <div className="growth-chart-card">
          <div className="chart-header">
            <h4>Lượt đăng ký người dùng mới (7 ngày qua)</h4>
          </div>
          <div className="chart-body-wrapper">
            <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="svg-chart">
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6b35" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ff6b35" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                const y = paddingTop + plotHeight * ratio;
                const val = Math.round(maxUsersVal * (1 - ratio));
                return (
                  <g key={index}>
                    <line 
                      x1={paddingLeft} 
                      y1={y} 
                      x2={chartWidth - paddingRight} 
                      y2={y} 
                      stroke="#e2e8f0" 
                      strokeWidth="1" 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x={paddingLeft - 8} 
                      y={y + 4} 
                      textAnchor="end" 
                      fontSize="10" 
                      fill="#718096"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Area Path */}
              {areaPath && <path d={areaPath} fill="url(#lineGrad)" />}

              {/* Line Path */}
              {linePath && (
                <path 
                  d={linePath} 
                  fill="none" 
                  stroke="#ff6b35" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              )}

              {/* X Axis Labels & Grid ticks */}
              {userPoints.map((p, idx) => (
                <g key={idx}>
                  <line 
                    x1={p.x} 
                    y1={paddingTop + plotHeight} 
                    x2={p.x} 
                    y2={paddingTop + plotHeight + 5} 
                    stroke="#a0aec0" 
                    strokeWidth="1" 
                  />
                  <text 
                    x={p.x} 
                    y={paddingTop + plotHeight + 18} 
                    textAnchor="middle" 
                    fontSize="10" 
                    fill="#718096"
                  >
                    {p.date}
                  </text>
                </g>
              ))}

              {/* Data points (circles) */}
              {userPoints.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill="#ffffff"
                  stroke="#ff6b35"
                  strokeWidth="3"
                  className="chart-data-point"
                  onMouseEnter={(e) => {
                    const rect = e.target.getBoundingClientRect();
                    setHoveredPoint({
                      x: p.x,
                      y: p.y,
                      label: `Người dùng mới: ${p.value}`,
                      date: p.date,
                      left: rect.left,
                      top: rect.top,
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}
            </svg>

            {/* Custom Interactive Tooltip */}
            {hoveredPoint && (
              <div 
                className="chart-tooltip"
                style={{
                  position: 'fixed',
                  left: `${hoveredPoint.left + 10}px`,
                  top: `${hoveredPoint.top - 50}px`,
                  zIndex: 1000
                }}
              >
                <div className="tooltip-date">{hoveredPoint.date}</div>
                <div className="tooltip-value">{hoveredPoint.label}</div>
              </div>
            )}
          </div>
        </div>

        {/* Posts & Messages Bar Chart */}
        <div className="growth-chart-card">
          <div className="chart-header">
            <h4>Hoạt động tương tác (Bài viết & Tin nhắn)</h4>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot posts-dot"></span>Bài viết</span>
              <span className="legend-item"><span className="legend-dot messages-dot"></span>Tin nhắn</span>
            </div>
          </div>
          <div className="chart-body-wrapper">
            <svg width="100%" height="100%" viewBox={`0 0 ${barChartWidth} ${barChartHeight}`} className="svg-chart">
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                const y = barPaddingTop + barPlotHeight * ratio;
                const val = Math.round(maxActivityVal * (1 - ratio));
                return (
                  <g key={index}>
                    <line 
                      x1={barPaddingLeft} 
                      y1={y} 
                      x2={barChartWidth - barPaddingRight} 
                      y2={y} 
                      stroke="#e2e8f0" 
                      strokeWidth="1" 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x={barPaddingLeft - 8} 
                      y={y + 4} 
                      textAnchor="end" 
                      fontSize="10" 
                      fill="#718096"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Render Bars */}
              {timeline.map((day, idx) => {
                const groupX = barPaddingLeft + idx * groupWidth;
                
                // Post Bar
                const postBarHeight = (day.newPosts / maxActivityVal) * barPlotHeight;
                const postX = groupX + groupWidth * 0.15;
                const postY = barPaddingTop + barPlotHeight - postBarHeight;

                // Message Bar
                const messageBarHeight = (day.newMessages / maxActivityVal) * barPlotHeight;
                const messageX = postX + barWidth + 4;
                const messageY = barPaddingTop + barPlotHeight - messageBarHeight;

                const centerLabelX = groupX + groupWidth / 2;

                return (
                  <g key={idx}>
                    {/* Post rect */}
                    <rect
                      x={postX}
                      y={postY}
                      width={barWidth}
                      height={Math.max(postBarHeight, 2)}
                      fill="#ff6b35"
                      rx="3"
                      ry="3"
                      className="chart-bar"
                      onMouseEnter={(e) => {
                        const rect = e.target.getBoundingClientRect();
                        setHoveredPoint({
                          x: postX,
                          y: postY,
                          label: `Bài viết mới: ${day.newPosts}`,
                          date: day.date,
                          left: rect.left,
                          top: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />

                    {/* Message rect */}
                    <rect
                      x={messageX}
                      y={messageY}
                      width={barWidth}
                      height={Math.max(messageBarHeight, 2)}
                      fill="#4d96ff"
                      rx="3"
                      ry="3"
                      className="chart-bar"
                      onMouseEnter={(e) => {
                        const rect = e.target.getBoundingClientRect();
                        setHoveredPoint({
                          x: messageX,
                          y: messageY,
                          label: `Tin nhắn gửi: ${day.newMessages}`,
                          date: day.date,
                          left: rect.left,
                          top: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />

                    {/* X Axis Labels */}
                    <line 
                      x1={centerLabelX} 
                      y1={barPaddingTop + barPlotHeight} 
                      x2={centerLabelX} 
                      y2={barPaddingTop + barPlotHeight + 5} 
                      stroke="#a0aec0" 
                      strokeWidth="1" 
                    />
                    <text 
                      x={centerLabelX} 
                      y={barPaddingTop + barPlotHeight + 18} 
                      textAnchor="middle" 
                      fontSize="10" 
                      fill="#718096"
                    >
                      {day.date}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Row 3: Breakdowns */}
      <div className="growth-distributions-grid">
        {/* Roles Breakdown */}
        <div className="distribution-card">
          <div className="card-header">
            <h4>Phân quyền tài khoản (Roles)</h4>
          </div>
          <div className="distribution-body">
            {Object.entries(rolesDistribution).map(([role, count]) => {
              const percentage = Math.round((count / totals.users) * 100) || 0;
              return (
                <div key={role} className="distribution-row">
                  <div className="dist-meta">
                    <span className="dist-name">{role}</span>
                    <span className="dist-count">{count} tài khoản ({percentage}%)</span>
                  </div>
                  <div className="dist-bar-bg">
                    <div 
                      className="dist-bar-fill role-bar" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Login Providers Breakdown */}
        <div className="distribution-card">
          <div className="card-header">
            <h4>Nguồn đăng nhập (Providers)</h4>
          </div>
          <div className="distribution-body">
            {Object.entries(providersDistribution).map(([provider, count]) => {
              const percentage = Math.round((count / totals.users) * 100) || 0;
              
              // Capitalize provider name
              const formattedProvider = provider === 'email' ? 'Email/Mật khẩu' 
                : provider.charAt(0).toUpperCase() + provider.slice(1);

              return (
                <div key={provider} className="distribution-row">
                  <div className="dist-meta">
                    <span className="dist-name">{formattedProvider}</span>
                    <span className="dist-count">{count} người dùng ({percentage}%)</span>
                  </div>
                  <div className="dist-bar-bg">
                    <div 
                      className={`dist-bar-fill provider-bar ${provider}`} 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
