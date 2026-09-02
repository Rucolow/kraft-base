import '@kraft-base/brand/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { applyTheme, readTheme } from '../lib/theme';
import { RotaApp } from './RotaApp';

// Same theme handling as the staff app: brand tokens + the remembered light/dark
// choice (dark is the default). Without the tokens import every rgb(var(--kb-*))
// resolves to nothing and the page renders black-on-white.
applyTheme(readTheme());

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <RotaApp />
    </StrictMode>,
  );
}
