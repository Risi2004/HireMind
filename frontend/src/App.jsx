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
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/profile-setup/about-you" element={<AboutYou />} />
          <Route path="/profile-setup/your-field" element={<YourField />} />
          <Route path="/profile-setup/career-stage" element={<CareerStage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-interview" element={<NewInterview />} />
          <Route path="/new-interview/token" element={<InterviewRoom />} />
          <Route path="/new-interview/:token" element={<InterviewRoom />} />
          <Route path="/interview-report" element={<InterviewReport />} />
          <Route path="/report" element={<InterviewReport />} />
          <Route path="/new-interview/report" element={<InterviewReport />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProfileSetupProvider>
  </AuthProvider>
  )
}

