import { Routes, Route, BrowserRouter, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import OTPVerificationPage from './pages/OTPVerificationPage';
import OnboardingPage from './pages/OnboardingPage';
import RoleSetupPage from './pages/RoleSetupPage';
import GoalsSetupPage from './pages/GoalsSetupPage';
import GoogleConnectPage from './pages/GoogleConnectPage';
import PrivacyTerms from './pages/PrivacyTerms';
import Contact from './pages/Contact';
import NotFoundPage from './pages/NotFoundPage';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    className="w-full"
  >
    {children}
  </motion.div>
);

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
        <Route path="/signin" element={<PageTransition><SignInPage /></PageTransition>} />
        <Route path="/signup" element={<PageTransition><SignUpPage /></PageTransition>} />
        <Route path="/forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
        <Route path="/verify-otp" element={<PageTransition><OTPVerificationPage /></PageTransition>} />
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <PageTransition><OnboardingPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/role-setup" element={
          <ProtectedRoute>
            <PageTransition><RoleSetupPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/goals-setup" element={
          <ProtectedRoute>
            <PageTransition><GoalsSetupPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/google-connect" element={
          <ProtectedRoute>
            <PageTransition><GoogleConnectPage /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/privacy" element={<PageTransition><PrivacyTerms /></PageTransition>} />
        <Route path="/terms" element={<PageTransition><PrivacyTerms /></PageTransition>} />
        <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
        <Route path="/dashboard/*" element={
          <ProtectedRoute>
            <PageTransition><Dashboard /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
