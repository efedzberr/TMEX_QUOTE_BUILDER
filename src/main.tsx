import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { CustomerReviewPortal } from './components/portal/CustomerReviewPortal.tsx';
import { CustomerReviewPreview } from './components/portal/CustomerReviewPreview.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/review/preview/:quoteId" element={<CustomerReviewPreview />} />
        <Route path="/review/:token" element={<CustomerReviewPortal />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </HashRouter>
  </StrictMode>
);
