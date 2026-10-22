import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SignupPage from "./pages/SignupPage";
import AuthLayout from "./components/AuthLayout";
import StepProgress from "./components/StepProgress";
import LegalPage from "./pages/LegalPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onSuccess={() => window.location.assign("/")} />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Home, sign-up and the rest come next. Until then everything lands on login. */}
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/signup/availability"
          element={<AuthLayout title="Your availability" lead="The calendar comes next."><StepProgress current={2} /></AuthLayout>}
        />
        <Route path="/terms" element={<LegalPage doc="terms" />} />
        <Route path="/privacy" element={<LegalPage doc="privacy" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}