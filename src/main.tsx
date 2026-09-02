import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { CustomerReviewPortal } from './components/portal/CustomerReviewPortal.tsx';
import { CustomerReviewPreview } from './components/portal/CustomerReviewPreview.tsx';
import { SetPasswordPage } from './components/auth/SetPasswordPage.tsx';
import { ConfirmLinkPage } from './components/auth/ConfirmLinkPage.tsx';
import { AuthProvider } from './lib/AuthContext.tsx';
import { AuthGate } from './components/auth/LoginFlow.tsx';
import { PermissionsProvider } from './lib/permissions.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes: customer portal + invitation set-password */}
          <Route path="/review/:token" element={<CustomerReviewPortal />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/auth/confirm" element={<ConfirmLinkPage />} />

          {/* El preview es de uso interno -> protegido */}
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
                <PermissionsProvider>
                  <App />
                </PermissionsProvider>
              </AuthGate>
            }
          />
        </Routes>
      </AuthProvider>
    </HashRouter>
  </StrictMode>
);
