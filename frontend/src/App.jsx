import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProfileSetupProvider } from './context/ProfileSetupContext'
import AboutYou from './pages/AboutYou'
import CareerStage from './pages/CareerStage'
import ProfileSetup from './pages/ProfileSetup'
import YourField from './pages/YourField'
import './App.css'

export default function App() {
  return (
    <ProfileSetupProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/profile-setup" replace />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/profile-setup/about-you" element={<AboutYou />} />
          <Route path="/profile-setup/your-field" element={<YourField />} />
          <Route path="/profile-setup/career-stage" element={<CareerStage />} />
          <Route path="*" element={<Navigate to="/profile-setup" replace />} />
        </Routes>
      </BrowserRouter>
    </ProfileSetupProvider>
  )
}
