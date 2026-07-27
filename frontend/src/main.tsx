import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles/theme.css';
import { configureAmplify } from '@/lib/amplify';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthProvider } from '@/auth/AuthProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import App from './App';
import MissingEnv from '@/pages/MissingEnv';

const configured = configureAmplify();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        {configured ? (
          <AuthProvider>
            <App />
          </AuthProvider>
        ) : (
          <MissingEnv />
        )}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
