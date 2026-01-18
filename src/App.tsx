// 智会 - 应用入口

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '@/components/common';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { PrivateRoute } from '@/components/PrivateRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Home } from '@/pages/Home';
import { Meeting } from '@/pages/Meeting';
import { PreJoin } from '@/pages/PreJoin';
import { Recordings } from '@/pages/Recordings';
import { MyRecordings } from '@/pages/MyRecordings';
import { Login } from '@/pages/Login';

import '@/i18n';
import '@/styles/index.css';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<Home />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />
              <Route
                path="/recordings"
                element={
                  <PrivateRoute>
                    <Recordings />
                  </PrivateRoute>
                }
              />
              <Route
                path="/my-recordings"
                element={
                  <PrivateRoute>
                    <MyRecordings />
                  </PrivateRoute>
                }
              />
              <Route
                path="/prejoin/:roomId"
                element={
                  <PrivateRoute>
                    <PreJoin />
                  </PrivateRoute>
                }
              />
              <Route
                path="/meeting/:roomId"
                element={
                  <PrivateRoute>
                    <ErrorBoundary fallback={<div style={{ padding: '40px', textAlign: 'center' }}>会议加载失败，请刷新页面</div>}>
                      <Meeting />
                    </ErrorBoundary>
                  </PrivateRoute>
                }
              />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </ErrorBoundary>
);
}

export default App;

