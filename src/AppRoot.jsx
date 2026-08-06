import { useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import App from './App';

export default function AppRoot() {
  const location = useLocation();

  return (
    <ThemeProvider>
      <AuthProvider>
        <ErrorBoundary resetKey={location.pathname}>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </ThemeProvider>
  );
}
