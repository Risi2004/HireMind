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

  const { user: authUser } = useAuth()

  // Use authenticated user's name if logged in, fallback to Jordan
  const user = useMemo(
    () => ({ name: authUser?.firstName || 'Jordan' }),
    [authUser?.firstName]
  )


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
    }),
    [
      user,
      resumeFile,
      field,
      customField,
      experienceLevel,
      careerStage,
      customCareerStage,
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
