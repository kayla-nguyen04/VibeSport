import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TasksDashboard from './pages/TasksDashboard';
import Growth from './pages/Growth';
import Users from './pages/Users';

function App() {
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/*" element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="growth" element={<Growth />} />
        <Route path="users" element={<Users />} />
        <Route path="tasks" element={<TasksDashboard />} />
      </Route>
    </Routes>
  );
}

export default App;