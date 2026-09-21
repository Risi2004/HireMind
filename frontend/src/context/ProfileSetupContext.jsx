import { createContext, useContext, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

const ProfileSetupContext = createContext(null)


const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Experienced']

export const FIELD_OPTIONS = [
  'Software Engineering',
  'Computer Science',
  'Information Technology',
  'Data Science',
  'Artificial Intelligence / Machine Learning',
  'Cyber Security',
  'Network Engineering',
  'Cloud Computing',
  'DevOps',
  'UI/UX Design',
  'Quality Assurance / Software Testing',
  'Business Information Systems',
  'Business Management',
  'Accounting & Finance',
  'Marketing',
  'Human Resource Management',
  'Engineering',
  'Healthcare',
  'Education',
  'Other',
]

export const CAREER_STAGE_OPTIONS = [
  'Student / Undergraduate',
  'Recent Graduate',
  'Intern / Trainee',
  'Entry-Level Professional',
  'Mid-Level Professional',
  'Senior Professional',
  'Career Changer',
  'Returning to Work',
  'Other',
]

export function ProfileSetupProvider({ children }) {
  const [resumeFile, setResumeFile] = useState(null)
  const [field, setField] = useState('')
  const [customField, setCustomField] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('Beginner')
  const [careerStage, setCareerStage] = useState('')
  const [customCareerStage, setCustomCareerStage] = useState('')

  const { user: authUser, token, setUser: setAuthUser } = useAuth()

  // Track GitHub connection state
  const [githubData, setGithubData] = useState(() => authUser?.github || {
    connected: false,
    username: '',
    profileUrl: '',
    avatarUrl: '',
    name: '',
    publicRepos: 0,
  })

  // Sync with authUser when user updates
  useMemo(() => {
    if (authUser?.github) {
      setGithubData(authUser.github)
    }
    if (authUser?.field && !field) {
      setField(authUser.field)
    }
    if (authUser?.careerStage && !careerStage) {
      setCareerStage(authUser.careerStage)
    }
    if (authUser?.experienceLevel) {
      setExperienceLevel(authUser.experienceLevel)
    }
  }, [authUser])

  const user = useMemo(
    () => ({ name: authUser?.firstName || 'Candidate' }),
    [authUser?.firstName]
  )

  // Connect GitHub account
  const connectGithub = async (username) => {
    if (!token) throw new Error('You must be logged in to connect GitHub.')
    const res = await fetch('/api/profile/github/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username }),
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to connect GitHub account')
    }

    setGithubData(data.github)
    if (data.user && setAuthUser) {
      setAuthUser(data.user)
    }
    return data
  }

  // Disconnect GitHub account
  const disconnectGithub = async () => {
    if (!token) return
    const res = await fetch('/api/profile/github/disconnect', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to disconnect GitHub account')
    }

    setGithubData({
      connected: false,
      username: '',
      profileUrl: '',
      avatarUrl: '',
      name: '',
      publicRepos: 0,
    })
    if (data.user && setAuthUser) {
      setAuthUser(data.user)
    }
    return data
  }

  // Submit complete profile setup (uploads resume to Cloudflare R2 and persists details)
  const submitProfileSetup = async () => {
    if (!token) throw new Error('You must be logged in to complete profile setup.')

    const formData = new FormData()
    if (resumeFile) {
      formData.append('resume', resumeFile)
    }
    formData.append('field', field)
    formData.append('customField', customField)
    formData.append('experienceLevel', experienceLevel)
    formData.append('careerStage', careerStage)
    formData.append('customCareerStage', customCareerStage)
    if (githubData?.username) {
      formData.append('githubUsername', githubData.username)
    }

    const res = await fetch('/api/profile/setup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || 'Failed to save profile setup')
    }

    if (data.user && setAuthUser) {
      setAuthUser(data.user)
    }

    return data
  }

  const value = useMemo(
    () => ({
      user,
      resumeFile,
      setResumeFile,
      clearResume: () => setResumeFile(null),
      field,
      setField,
      customField,
      setCustomField,
      experienceLevel,
      setExperienceLevel,
      experienceLevels: EXPERIENCE_LEVELS,
      fieldOptions: FIELD_OPTIONS,
      careerStage,
      setCareerStage,
      customCareerStage,
      setCustomCareerStage,
      careerStageOptions: CAREER_STAGE_OPTIONS,
      githubData,
      connectGithub,
      disconnectGithub,
      submitProfileSetup,
    }),
    [
      user,
      resumeFile,
      field,
      customField,
      experienceLevel,
      careerStage,
      customCareerStage,
      githubData,
      token,
    ]
  )

  return (
    <ProfileSetupContext.Provider value={value}>
      {children}
    </ProfileSetupContext.Provider>
  )
}

export function useProfileSetup() {
  const context = useContext(ProfileSetupContext)
  if (!context) {
    throw new Error('useProfileSetup must be used within ProfileSetupProvider')
  }
  return context
}
