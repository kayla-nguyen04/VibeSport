import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Growth from './pages/Growth';
import PostsPage from './pages/PostsPage';
import RemovedContentPage from './pages/RemovedContentPage';

function App() {
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/*" element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}>
        <Route index element={<Growth />} />
        <Route path="growth" element={<Growth />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="deleted-content" element={<RemovedContentPage />} />
      </Route>
    </Routes>
  );
}

export default App;
