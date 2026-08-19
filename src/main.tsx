import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { CustomerReviewPortal } from './components/portal/CustomerReviewPortal.tsx';
import { CustomerReviewPreview } from './components/portal/CustomerReviewPreview.tsx';
import { AuthProvider } from './lib/AuthContext.tsx';
import { AuthGate } from './components/auth/LoginFlow.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <Routes>
          {/* ÚNICO acceso público: portal de cliente vía token */}
          <Route path="/review/:token" element={<CustomerReviewPortal />} />

          {/* El preview es de uso interno → protegido */}
          <Route
            path="/review/preview/:quoteId"
            element={
              <AuthGate>
                <CustomerReviewPreview />
              </AuthGate>
            }
          />

          {/* Toda la app interna requiere login + 2FA */}
          <Route
            path="/*"
            element={
              <AuthGate>
                <App />
              </AuthGate>
            }
          />
        </Routes>
      </AuthProvider>
    </HashRouter>
  </StrictMode>
);
