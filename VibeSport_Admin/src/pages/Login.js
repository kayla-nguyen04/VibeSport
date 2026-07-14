import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../redux/slices/authSlice';
import './Login.css';

const LogoMark = () => (
  <div className="logo-mark">
    <img src="/logoVibe.png" alt="VibeSport" className="logo-img" />
  </div>
);

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isLoading, error, isAuthenticated } = useSelector((state) => state.auth);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => dispatch(clearError());
  }, [dispatch]);

  const identifierError =
    touched && !identifier.trim()
      ? 'Vui lòng nhập email hoặc số điện thoại'
      : '';

  const passwordError =
    touched && !password ? 'Vui lòng nhập mật khẩu' : '';

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);

    if (!identifier.trim() || !password) return;

    dispatch(
      login({
        email: identifier.trim(),
        password,
        remember,
      })
    );
  };

  return (
    <div className="login-page">
      <div className="login-frame">
        <div className="login-grid">

          {/* ===== LOGO BÊN TRÁI ===== */}
          <div className="login-brand">
            <svg className="streaks" viewBox="0 0 420 260" fill="none">
              <path
                d="M-20 220 C 90 180, 160 240, 260 160 S 420 60 460 40"
                stroke="url(#g1)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M-20 250 C 100 210, 170 260, 280 190 S 430 90 470 70"
                stroke="url(#g1)"
                strokeWidth="6"
                strokeOpacity=".35"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="420" y2="0">
                  <stop offset="0" stopColor="#FF9147" />
                  <stop offset=".55" stopColor="#FF6B1A" />
                  <stop offset="1" stopColor="#FF9147" />
                </linearGradient>
              </defs>
            </svg>

            <LogoMark />
          </div>

          {/* ===== FORM BÊN PHẢI ===== */}
          <div className="login-form-wrap">
            <form
              className="login-form"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="top-logo">
                <LogoMark />
              </div>

              <h2>Đăng nhập quản trị</h2>

              <div className="sub">
                Nhập thông tin tài khoản admin để tiếp tục
              </div>

              {error && (
                <div className="form-error-banner">
                  {error}
                </div>
              )}

              <div className="field">
                <label htmlFor="identifier">
                  Email hoặc số điện thoại
                </label>

                <input
                  id="identifier"
                  type="text"
                  placeholder="admin@vibesport.vn"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                />

                {identifierError && (
                  <div className="field-error">
                    {identifierError}
                  </div>
                )}
              </div>

              <div className="field">
                <label htmlFor="password">
                  Mật khẩu
                </label>

                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                {passwordError && (
                  <div className="field-error">
                    {passwordError}
                  </div>
                )}
              </div>

              <div className="row-between">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) =>
                      setRemember(e.target.checked)
                    }
                  />

                  Ghi nhớ đăng nhập
                </label>

                <button
                  type="button"
                  className="forgot"
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                className="btn-login"
                type="submit"
                disabled={isLoading}
              >
                {isLoading
                  ? 'Đang đăng nhập...'
                  : 'Đăng nhập'}
              </button>

              <div className="signup-line">
                Chưa có tài khoản quản trị?{' '}
                <a href="#lien-he">
                  Liên hệ chủ hệ thống
                </a>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;