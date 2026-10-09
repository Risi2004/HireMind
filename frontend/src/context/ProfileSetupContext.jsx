import { useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { ProfileSetupContext } from './profileSetupContextObject'
import {
  EXPERIENCE_LEVELS,
  FIELD_OPTIONS,
  CAREER_STAGE_OPTIONS,
  POPULAR_SKILLS,
} from '../constants/profileOptions'
import { getApiUrl } from '../config/api'

// Helper for making API calls with dynamic backend base URL (Method 2)
const apiFetch = (endpoint, options) => fetch(getApiUrl(endpoint), options)


export function ProfileSetupProvider({ children }) {
  const [resumeFile, setResumeFile] = useState(null)
  const [field, setField] = useState('')
  const [customField, setCustomField] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('Beginner')
  const [careerStage, setCareerStage] = useState('')
  const [customCareerStage, setCustomCareerStage] = useState('')
  const [skills, setSkills] = useState([])
  const [careerInterests, setCareerInterests] = useState([])

  // Automatic skill detection state from CV
  const [isExtractingSkills, setIsExtractingSkills] = useState(false)
  const [extractedSkills, setExtractedSkills] = useState([])
  const [extractionError, setExtractionError] = useState(null)
  const [lastExtractedSource, setLastExtractedSource] = useState(null)

  const { user: authUser, token, setUser: setAuthUser } = useAuth()

  // Helper to add a skill (strictly avoids duplicates, trims whitespace, supports comma-separated input)
  const addSkill = (skill) => {
    if (!skill) return
    const items = typeof skill === 'string' ? skill.split(',') : [skill]
    setSkills((prev) => {
      const existingLower = new Set(
        prev.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean)
      )
      const toAdd = []
      for (const item of items) {
        if (!item || typeof item !== 'string') continue
        const trimmed = item.trim()
        if (!trimmed) continue
        const lower = trimmed.toLowerCase()
        if (!existingLower.has(lower)) {
          existingLower.add(lower)
          toAdd.push(trimmed)
        }
      }
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev
    })
  }

  // Helper to remove a skill (case-insensitive exact match)
  const removeSkill = (skillToRemove) => {
    if (!skillToRemove) return
    const target = String(skillToRemove).trim().toLowerCase()
    setSkills((prev) => prev.filter((s) => s.trim().toLowerCase() !== target))
  }

  // Extract skills automatically from CV without duplicating any existing skills
  const extractSkillsFromResume = async (fileToUse = undefined, force = false) => {
    const file = fileToUse !== undefined ? fileToUse : resumeFile
    const sourceKey = file
      ? `${file.name}_${file.size}_${file.lastModified}`
      : (authUser?.resumeFileName || authUser?.resumeUrl || '')

    if (!sourceKey) return []
    // Skip if already extracted for this resume source unless force is true
    if (!force && sourceKey === lastExtractedSource && extractedSkills.length > 0) {
      return extractedSkills
    }

    setIsExtractingSkills(true)
    setExtractionError(null)

    try {
      const activeToken = token || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const formData = new FormData()

      if (file) {
        formData.append('resume', file)
      } else {
        formData.append('useProfileResume', 'true')
      }

      const res = await apiFetch('/api/profile/extract-skills', {
        method: 'POST',
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.success && Array.isArray(data.skills)) {
        const detected = data.skills

        // Merge detected skills into existing skills without ANY duplicates (case-insensitive)
        setSkills((prev) => {
          const existingLower = new Set(
            prev.map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : '')).filter(Boolean)
          )
          const newUnique = []
          for (const item of detected) {
            if (!item || typeof item !== 'string') continue
            const trimmed = item.trim()
            if (!trimmed) continue
            const lower = trimmed.toLowerCase()
            if (!existingLower.has(lower)) {
              existingLower.add(lower)
              newUnique.push(trimmed)
            }
          }
          return newUnique.length > 0 ? [...prev, ...newUnique] : prev
        })

        setExtractedSkills(detected)
        setLastExtractedSource(sourceKey)

        // If field is empty and role is detected, auto-fill field if matched
        if (!field && data.detectedRole) {
          const matched = FIELD_OPTIONS.find(
            (fo) =>
              fo.toLowerCase().includes(data.detectedRole.toLowerCase()) ||
              data.detectedRole.toLowerCase().includes(fo.toLowerCase())
          )
          if (matched) setField(matched)
        }

        return detected
      } else {
        const msg = data.message || 'Could not extract skills from resume.'
        setExtractionError(msg)
        return []
      }
    } catch (err) {
      console.warn('Skill extraction error:', err.message)
      setExtractionError(err.message)
      return []
    } finally {
      setIsExtractingSkills(false)
    }
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

  // Sync with authUser whenever the signed-in user object changes.
  // Uses React's "adjust state while rendering" pattern (guarded by a comparison so it
  // runs once per change) instead of an effect, avoiding an extra render pass.
  const [syncedAuthUser, setSyncedAuthUser] = useState(null)
  if (authUser !== syncedAuthUser) {
    setSyncedAuthUser(authUser)
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
  }

  const user = useMemo(
    () => ({ name: authUser?.firstName || 'Candidate' }),
    [authUser?.firstName]
  )

  // Connect GitHub account
  const connectGithub = async (username) => {
    if (!token) throw new Error('You must be logged in to connect GitHub.')
    const res = await apiFetch('/api/profile/github/connect', {
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
    const res = await apiFetch('/api/profile/github/disconnect', {
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
    const targetUrl = getApiUrl(`/api/profile/github/auth?token=${encodeURIComponent(activeToken)}&redirect=${encodeURIComponent(redirectPath)}`)
    window.location.href = targetUrl
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

    const res = await apiFetch('/api/profile/setup', {
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
      localStorage.setItem('hiremind_user', JSON.stringify(data.user))
    }

    return data
  }

  const clearResume = () => {
    setResumeFile(null)
    setLastExtractedSource(null)
    setExtractedSkills([])
  }

  const value = {
    user,
    resumeFile,
    setResumeFile,
    clearResume,
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
    isExtractingSkills,
    extractedSkills,
    extractionError,
    lastExtractedSource,
    extractSkillsFromResume,
  }

  return (
    <ProfileSetupContext.Provider value={value}>
      {children}
    </ProfileSetupContext.Provider>
  )
}
