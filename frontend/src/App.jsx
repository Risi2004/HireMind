import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProfileSetupProvider } from './context/ProfileSetupContext'
import AboutYou from './pages/AboutYou'
import CareerStage from './pages/CareerStage'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import InterviewRoom from './pages/InterviewRoom'
import InterviewReport from './pages/InterviewReport'
import Login from './pages/Login'
import NewInterview from './pages/NewInterview'
import Profile from './pages/Profile'
import ProfileSetup from './pages/ProfileSetup'
import Signup from './pages/Signup'
import YourField from './pages/YourField'

// Admin Foundation
import AdminLayout from './admin/AdminLayout'
import AdminDashboard from './admin/pages/AdminDashboard'
import AdminUsers from './admin/pages/AdminUsers'
import AdminPilotAccess from './admin/pages/AdminPilotAccess'
import AdminInterviews from './admin/pages/AdminInterviews'
import AdminFeedback from './admin/pages/AdminFeedback'
import AdminAnalytics from './admin/pages/AdminAnalytics'
import AdminAiControl from './admin/pages/AdminAiControl'
import AdminReports from './admin/pages/AdminReports'
import AdminLogs from './admin/pages/AdminLogs'
import AdminSettings from './admin/pages/AdminSettings'

import AdminProtectedRoute from './admin/AdminProtectedRoute'
import CandidateProtectedRoute from './components/CandidateProtectedRoute'

import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <ProfileSetupProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/forgot" element={<Navigate to="/forgot-password" replace />} />

            {/* Candidate Protected Routes (Restricted to non-admin candidates; admins auto-redirect to /admin/dashboard) */}
            <Route element={<CandidateProtectedRoute />}>
              <Route path="/profile-setup" element={<ProfileSetup />} />
              <Route path="/profile-setup/about-you" element={<AboutYou />} />
              <Route path="/profile-setup/your-field" element={<YourField />} />
              <Route path="/profile-setup/career-stage" element={<CareerStage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/new-interview" element={<NewInterview />} />
              <Route path="/new-interview/:id" element={<NewInterview />} />
              <Route path="/new-interview/:id/room" element={<InterviewRoom />} />
              <Route path="/new-interview/token" element={<InterviewRoom />} />
              <Route path="/new-interview/room" element={<InterviewRoom />} />
              <Route path="/interview-room/:id" element={<InterviewRoom />} />
              <Route path="/interview-room" element={<InterviewRoom />} />
              <Route path="/interview-report" element={<InterviewReport />} />
              <Route path="/report" element={<InterviewReport />} />
              <Route path="/new-interview/report" element={<InterviewReport />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/my-profile" element={<Profile />} />
            </Route>

            {/* Admin Portal Protected Routes (Restricted strictly to role: 'admin') */}
            <Route path="/admin" element={<AdminProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="pilot-access" element={<AdminPilotAccess />} />
                <Route path="interviews" element={<AdminInterviews />} />
                <Route path="feedback" element={<AdminFeedback />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="ai-control" element={<AdminAiControl />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="logs" element={<AdminLogs />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ProfileSetupProvider>
    </AuthProvider>
  )
}

