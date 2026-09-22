import { createContext, useContext, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

const ProfileSetupContext = createContext(null)


export const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Experienced']

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
]

export const POPULAR_SKILLS = [
  'React',
  'JavaScript',
  'TypeScript',
  'Node.js',
  'Python',
  'Java',
  'C++',
  'C#',
  'HTML5',
  'CSS3',
  'Next.js',
  'Vue.js',
  'Angular',
  'Express',
  'Django',
  'Flask',
  'FastAPI',
  'Spring Boot',
  'SQL',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'Google Cloud',
  'Azure',
  'Git',
  'Linux',
  'REST APIs',
  'GraphQL',
  'Microservices',
  'Machine Learning',
  'Deep Learning',
  'PyTorch',
  'TensorFlow',
  'Data Science',
  'Pandas',
  'NumPy',
  'UI/UX Design',
  'Figma',
  'CI/CD',
  'Cyber Security',
  'Network Engineering',
  'Agile / Scrum',
  'System Design',
  'Testing & QA',
  'Go',
  'Rust',
  'Swift',
  'Kotlin',
  'Flutter',
]

export function ProfileSetupProvider({ children }) {
  const [resumeFile, setResumeFile] = useState(null)
  const [field, setField] = useState('')
  const [customField, setCustomField] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('Beginner')
  const [careerStage, setCareerStage] = useState('')
  const [customCareerStage, setCustomCareerStage] = useState('')
  const [skills, setSkills] = useState([])
  const [careerInterests, setCareerInterests] = useState([
    'Full Stack Development',
    'AI Engineering',
  ])

  const { user: authUser, token, setUser: setAuthUser } = useAuth()

  // Helper to add a skill (avoids duplicates, trims whitespace)
  const addSkill = (skill) => {
    if (!skill) return
    const trimmed = typeof skill === 'string' ? skill.trim() : ''
    if (!trimmed) return
    setSkills((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === trimmed.toLowerCase())
      if (exists) return prev
      return [...prev, trimmed]
    })
  }

  // Helper to remove a skill
  const removeSkill = (skillToRemove) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove))
  }

  // Helper to add a career interest
  const addCareerInterest = (interest) => {
    if (!interest) return
    const trimmed = typeof interest === 'string' ? interest.trim() : ''
    if (!trimmed) return
    setCareerInterests((prev) => {
      const exists = prev.some((i) => i.toLowerCase() === trimmed.toLowerCase())
      if (exists) return prev
      return [...prev, trimmed]
    })
  }

  // Helper to remove a career interest
  const removeCareerInterest = (interestToRemove) => {
    setCareerInterests((prev) => prev.filter((i) => i !== interestToRemove))
  }

  // Track GitHub connection state
  const [githubData, setGithubData] = useState(() => authUser?.github || {
    connected: false,
    username: '',
    profileUrl: '',
    avatarUrl: '',
    name: '',
    publicRepos: 0,
    repos: [],
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
    if (authUser?.skills && Array.isArray(authUser.skills) && skills.length === 0) {
      setSkills(authUser.skills)
    }
    if (authUser?.careerInterests && Array.isArray(authUser.careerInterests) && authUser.careerInterests.length > 0) {
      setCareerInterests(authUser.careerInterests)
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
      repos: [],
    })
    if (data.user && setAuthUser) {
      setAuthUser(data.user)
    }
    return data
  }

  // Initiate full GitHub OAuth 2.0 redirect
  const startGithubOAuth = (redirectPath = '/profile-setup') => {
    const activeToken = token || localStorage.getItem('hiremind_token')
    if (!activeToken) {
      alert('Please log in first to connect GitHub.')
      return
    }
    const backendUrl = window.location.port === '5173' ? 'http://localhost:5000' : ''
    window.location.href = `${backendUrl}/api/profile/github/auth?token=${encodeURIComponent(activeToken)}&redirect=${encodeURIComponent(redirectPath)}`
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
    if (skills && skills.length > 0) {
      formData.append('skills', JSON.stringify(skills))
    }
    if (careerInterests && careerInterests.length > 0) {
      formData.append('careerInterests', JSON.stringify(careerInterests))
    }
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
      skills,
      setSkills,
      addSkill,
      removeSkill,
      popularSkills: POPULAR_SKILLS,
      careerInterests,
      setCareerInterests,
      addCareerInterest,
      removeCareerInterest,
      githubData,
      connectGithub,
      disconnectGithub,
      startGithubOAuth,
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
      skills,
      careerInterests,
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
