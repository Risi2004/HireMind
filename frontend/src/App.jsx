import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProfileSetupProvider } from './context/ProfileSetupContext'
import AboutYou from './pages/AboutYou'
import CareerStage from './pages/CareerStage'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Login from './pages/Login'
import ProfileSetup from './pages/ProfileSetup'
import Signup from './pages/Signup'
import YourField from './pages/YourField'
import './App.css'

export default function App() {
  return (
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProfileSetupProvider>
  )
}
