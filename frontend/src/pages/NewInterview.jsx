import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import recordingDotIcon from '../assets/icons/recording.svg'
import attachmentIcon from '../assets/icons/attachment.svg'
import chatbotIcon from '../assets/icons/chatbot.svg'
import jdSkillsIcon from '../assets/icons/jdskills.svg'
import researchEngIcon from '../assets/icons/research engineering.svg'
import genQuestionsIcon from '../assets/icons/generating questions.svg'
import tick2Icon from '../assets/icons/tick2.svg'
import ProfileDropdown from '../components/ProfileDropdown'
import { useAuth } from '../context/AuthContext'
import { generateInterviewId, getInterviewSession, saveInterviewSession } from '../utils/interviewUtils'
import './NewInterview.css'

export default function NewInterview() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user: authUser, token: authToken, connectUserGithub } = useAuth()

  // Profile-level GitHub status
  const userGithub = authUser?.github
  const isProfileGithubConnected = Boolean(userGithub?.connected)
  const profileGithubUsername = userGithub?.username || ''
  const profileGithubReposCount = userGithub?.publicRepos || userGithub?.repos?.length || 0

  // GitHub connection modal state (when user hasn't connected in profile yet)
  const [showGithubModal, setShowGithubModal] = useState(false)
  const [githubModalInput, setGithubModalInput] = useState('')
  const [isConnectingGithub, setIsConnectingGithub] = useState(false)
  const [githubModalError, setGithubModalError] = useState(null)

  // Auto-generate unique ID if accessed at /new-interview directly
  useEffect(() => {
    if (!id) {
      navigate(`/new-interview/${generateInterviewId()}`, { replace: true })
    }
  }, [id, navigate])

  // Session recording state & timer
  const [isRecording, setIsRecording] = useState(false)
  const [secondsElapsed, setSecondsElapsed] = useState(0)

  // Form setup state
  const [targetRole, setTargetRole] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [interviewType, setInterviewType] = useState('Role-Specific')
  const [difficulty, setDifficulty] = useState('Intermediate')
  const [duration, setDuration] = useState('30 min')
  const [uploadedResume, setUploadedResume] = useState(null)
  const [currentResumeFile, setCurrentResumeFile] = useState(null)
  const [isGithubConnected, setIsGithubConnected] = useState(() => {
    return Boolean(authUser?.github?.connected)
  })
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activeMobileTab, setActiveMobileTab] = useState('setup') // 'setup' | 'gauge' | 'pipeline'
  const [useProfileResumeChoiceDismissed, setUseProfileResumeChoiceDismissed] = useState(false)

  // AI Resume Analysis State (Google ADK & OpenRouter)
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false)
  const [resumeAnalysis, setResumeAnalysis] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)

  // AI Job Description Analysis State (Google ADK & OpenRouter)
  const [isAnalyzingJd, setIsAnalyzingJd] = useState(false)
  const [jdAnalysis, setJdAnalysis] = useState(null)
  const [jdAnalysisError, setJdAnalysisError] = useState(null)

  // AI Interview Planning Agent State (Google ADK & OpenRouter)
  const [isPlanning, setIsPlanning] = useState(false)
  const [planningMessage, setPlanningMessage] = useState('Preparing your personalized interview...')
  const [planData, setPlanData] = useState(null)
  const [showPlanView, setShowPlanView] = useState(false)
  const [planError, setPlanError] = useState(null)

  const fileInputRef = useRef(null)
  const isLoadedRef = useRef(false)

  // Sync isGithubConnected if user has GitHub connected in profile
  useEffect(() => {
    if (isProfileGithubConnected && !isLoadedRef.current) {
      setIsGithubConnected(true)
    }
  }, [isProfileGithubConnected])

  const handleGithubButtonClick = () => {
    if (isProfileGithubConnected) {
      // Toggle for this interview
      setIsGithubConnected((prev) => !prev)
    } else {
      // Not yet connected in profile: prompt user to connect right at this point
      setGithubModalError(null)
      setGithubModalInput('')
      setShowGithubModal(true)
    }
  }

  const handleConnectGithubSubmit = async (e) => {
    e.preventDefault()
    if (!githubModalInput.trim()) return

    setIsConnectingGithub(true)
    setGithubModalError(null)

    try {
      const cleanUsername = githubModalInput
        .trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\/.*$/, '')
        .replace(/^@/, '')

      if (!cleanUsername) {
        throw new Error('Please enter a valid GitHub username or profile link')
      }

      if (connectUserGithub) {
        await connectUserGithub(cleanUsername)
      }
      setIsGithubConnected(true)
      setShowGithubModal(false)
      setGithubModalInput('')
    } catch (err) {
      setGithubModalError(err.message || 'Failed to connect GitHub account. Please check the username.')
    } finally {
      setIsConnectingGithub(false)
    }
  }

  // Agentic AI check: Determine whether GitHub is relevant (shown optionally for technical/developer roles, hidden for non-tech)
  const showGithubOption = useMemo(() => {
    // 1. Highest confidence: AI Job Description Analyzer Agent decision
    if (jdAnalysis?.role_understanding?.is_technical_role !== undefined) {
      return Boolean(jdAnalysis.role_understanding.is_technical_role)
    }

    // 2. High confidence: AI Resume Analyzer Agent decision
    if (resumeAnalysis?.is_technical_role !== undefined) {
      return Boolean(resumeAnalysis.is_technical_role)
    }

    // 3. Fallback heuristic on current Target Role before AI completes
    if (targetRole && targetRole.trim()) {
      const nonTechRegex = /(human resource|recruiter|talent acquisition|marketing|accountant|accounting|finance|sales|legal|business administration|operations manager|office manager)/i
      if (nonTechRegex.test(targetRole)) return false

      const techRegex = /(developer|engineer|software|frontend|backend|full-?stack|devops|cloud|data|ai|ml|coder|programming|architect|qa|tester|cyber|web)/i
      if (techRegex.test(targetRole)) return true
    }

    // 4. Fallback on user's registered domain/field
    if (authUser?.field) {
      const nonTechFields = ['Business Management', 'Accounting & Finance', 'Marketing', 'Human Resource Management', 'Healthcare', 'Education']
      if (nonTechFields.includes(authUser.field)) return false
    }

    // Default to true for standard engineering/developer sessions
    return true
  }, [jdAnalysis, resumeAnalysis, targetRole, authUser])

  // Load existing session data on mount
  useEffect(() => {
    if (!id) return

    const session = getInterviewSession(id)
    if (session) {
      if (session.targetRole && session.targetRole !== 'New Interview') setTargetRole(session.targetRole)
      if (session.company) setCompany(session.company)
      if (session.jobDescription) setJobDescription(session.jobDescription)
      if (session.interviewType) setInterviewType(session.interviewType)
      if (session.difficulty) setDifficulty(session.difficulty)
      if (session.duration) setDuration(session.duration)
      if (session.uploadedResume) setUploadedResume(session.uploadedResume)
      if (session.resumeAnalysis) setResumeAnalysis(session.resumeAnalysis)
      if (session.jdAnalysis) setJdAnalysis(session.jdAnalysis)
      if (session.userFacingPlan || session.interviewPlan) {
        setPlanData(session.userFacingPlan || session.interviewPlan)
      }
      if (session.isGithubConnected !== undefined) {
        setIsGithubConnected(session.isGithubConnected)
      } else if (authUser?.github?.connected) {
        setIsGithubConnected(true)
      }
    }

    // Attempt to fetch from backend MongoDB as primary source of truth
    fetch(`http://localhost:5000/api/interview/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success && data.session) {
          const s = data.session
          if (s.targetRole && s.targetRole !== 'New Interview') setTargetRole(s.targetRole)
          if (s.company) setCompany(s.company)
          if (s.jobDescription) setJobDescription(s.jobDescription)
          if (s.interviewType) setInterviewType(s.interviewType)
          if (s.difficulty) setDifficulty(s.difficulty)
          if (s.duration) setDuration(s.duration)
          if (s.resumeFileName) setUploadedResume(s.resumeFileName.replace(/^resumes\//, ''))
          if (s.jdAnalysis) setJdAnalysis(s.jdAnalysis)
          if (s.userFacingPlan || s.interviewPlan) {
            setPlanData(s.userFacingPlan || s.interviewPlan)
            if (s.status === 'planned') {
              setShowPlanView(true)
            }
          }
          if (s.isGithubConnected !== undefined) {
            setIsGithubConnected(s.isGithubConnected)
          } else if (authUser?.github?.connected) {
            setIsGithubConnected(true)
          }
          // Discard old mock fallbacks
          if (s.resumeAnalysis && !s.resumeAnalysis?.summary?.includes('Qualified software engineer')) {
            setResumeAnalysis(s.resumeAnalysis)
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        isLoadedRef.current = true
      })
  }, [id])

  // Auto-save any form changes to persistent storage
  useEffect(() => {
    if (!id || !isLoadedRef.current) return

    saveInterviewSession({
      id,
      targetRole: targetRole || '',
      company: company || '',
      jobDescription,
      interviewType,
      difficulty,
      duration,
      uploadedResume,
      resumeAnalysis,
      jdAnalysis,
      isGithubConnected,
      status: isAnalyzingResume ? 'analyzing_resume' : isAnalyzingJd ? 'analyzing_jd' : 'setup',
      lastVisitedPath: `/new-interview/${id}`,
    })

    // Debounced automatic persistence to MongoDB on any selection change
    const syncTimer = setTimeout(() => {
      try {
        const activeToken = authToken || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
        fetch(`http://localhost:5000/api/interview/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
          body: JSON.stringify({
            userId: authUser?._id || undefined,
            targetRole: targetRole || '',
            company: company || '',
            jobDescription,
            interviewType,
            difficulty,
            duration,
            isGithubConnected,
            resumeAnalysis,
            jdAnalysis,
          }),
        }).catch((err) => {
          console.warn('[Interview Session] Sync to MongoDB failed:', err.message)
        })
      } catch (_) {}
    }, 300)

    return () => clearTimeout(syncTimer)
  }, [id, targetRole, company, jobDescription, interviewType, difficulty, duration, uploadedResume, resumeAnalysis, jdAnalysis, isGithubConnected, isAnalyzingResume, isAnalyzingJd, authUser, authToken])

  // Live timer effect
  useEffect(() => {
    let interval = null
    if (isRecording) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleStartToggle = async () => {
    if (isAnalyzingResume || isAnalyzingJd) return
    if (!isSetupComplete) return

    const interviewId = id || generateInterviewId()

    // If plan is already generated and ready, toggle directly to the plan view
    if (planData && planData.stages && planData.stages.length > 0) {
      setShowPlanView(true)
      return
    }

    // Call Interview Planning Agent to generate personalized interview plan
    setIsPlanning(true)
    setPlanError(null)
    setPlanningMessage('Preparing your personalized interview...')

    const messageInterval = setInterval(() => {
      setPlanningMessage((prev) => {
        if (prev.includes('Preparing')) return 'Analyzing your experience and target role...'
        if (prev.includes('Analyzing')) return 'Structuring interview stages and time allocations...'
        return 'Finalizing your personalized interview agenda...'
      })
    }, 2800)

    try {
      const activeToken = authToken || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          targetRole: targetRole || '',
          company: company || '',
          jobDescription,
          interviewType,
          difficulty,
          duration,
          isGithubConnected,
        }),
      })

      const data = await res.json()
      clearInterval(messageInterval)

      if (res.ok && data.success && data.plan) {
        setPlanData(data.plan)
        setShowPlanView(true)
        saveInterviewSession({
          id: interviewId,
          targetRole: targetRole || '',
          company: company || '',
          jobDescription,
          interviewType,
          difficulty,
          duration,
          uploadedResume,
          resumeAnalysis,
          jdAnalysis,
          isGithubConnected,
          userFacingPlan: data.plan,
          interviewPlan: data.internalPlan,
          status: 'planned',
          lastVisitedPath: `/new-interview/${interviewId}`,
        })
      } else {
        setPlanError(data.message || 'Unable to generate interview plan. Please verify resume analysis is complete.')
      }
    } catch (err) {
      clearInterval(messageInterval)
      console.error('Error generating plan:', err)
      setPlanError('Network error connecting to planning service. Please try again.')
    } finally {
      setIsPlanning(false)
    }
  }

  const handleBeginInterview = () => {
    const interviewId = id || generateInterviewId()
    saveInterviewSession({
      id: interviewId,
      status: 'in_progress',
      lastVisitedPath: `/new-interview/${interviewId}/room`,
    })

    try {
      const activeToken = authToken || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      fetch(`http://localhost:5000/api/interview/${interviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          status: 'in_progress',
        }),
      }).catch(() => {})
    } catch (_) {}

    navigate(`/new-interview/${interviewId}/room`)
  }

  // Trigger Google ADK Resume Analyzer via Backend
  const triggerResumeAnalysis = async (file, useProfile = false) => {
    if (!file && !useProfile) return

    setIsAnalyzingResume(true)
    setAnalysisError(null)

    if (file) setCurrentResumeFile(file)
    const displayFilename = file ? file.name : (authUser?.resumeFileName?.replace(/^resumes\//, '') || 'Profile_Resume.pdf')
    setUploadedResume(displayFilename)

    try {
      const formData = new FormData()
      if (useProfile) {
        formData.append('useProfileResume', 'true')
        if (authUser?._id) formData.append('userId', authUser._id)
      } else {
        formData.append('resume', file)
      }
      if (authUser) {
        formData.append('candidateName', `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim())
      }

      const activeToken = authToken || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/interview/${id}/analyze-resume`, {
        method: 'POST',
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
        },
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setResumeAnalysis(data.resumeAnalysis)
        setAnalysisError(null)
        if (data.resumeFileName) {
          setUploadedResume(data.resumeFileName.replace(/^resumes\//, ''))
        }
        // Auto-fill target role from resume if currently blank
        if (!targetRole && data.resumeAnalysis?.detected_role) {
          setTargetRole(data.resumeAnalysis.detected_role)
        }
      } else {
        // No silent fallback — display exact error from AI service
        setResumeAnalysis(null)
        const errMsg = data.message || `Analysis failed (${res.status}): AI service unreachable.`
        setAnalysisError(errMsg)
        console.error('Resume analyzer error:', errMsg)
      }
    } catch (err) {
      // Network or connection error to backend
      setResumeAnalysis(null)
      const errMsg = `Could not reach backend service: ${err.message}`
      setAnalysisError(errMsg)
      console.error('Resume analyzer network error:', errMsg)
    } finally {
      setIsAnalyzingResume(false)
    }
  }

  const handleViewProfileResume = (e) => {
    if (e) e.stopPropagation()
    if (!authUser?.resumeFileName && !authUser?.resumeUrl) return

    const activeToken = authToken || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
    let targetUrl = authUser?.resumeUrl
    if (!targetUrl) {
      const cleanFilename = (authUser?.resumeFileName || '').replace(/^resumes\//, '')
      targetUrl = `/api/profile/resume/${encodeURIComponent(cleanFilename || 'view')}`
    }

    const separator = targetUrl.includes('?') ? '&' : '?'
    const baseBackend = 'http://localhost:5000'
    const fullUrl = targetUrl.startsWith('http')
      ? targetUrl
      : `${baseBackend}${targetUrl}${separator}token=${encodeURIComponent(activeToken || '')}`

    window.open(fullUrl, '_blank', 'noopener,noreferrer')
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      triggerResumeAnalysis(file, false)
    }
  }

  const handleRemoveResume = (e) => {
    if (e) e.stopPropagation()
    setUploadedResume(null)
    setResumeAnalysis(null)
    setCurrentResumeFile(null)
    setAnalysisError(null)
    setUseProfileResumeChoiceDismissed(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      triggerResumeAnalysis(file, false)
    }
  }

  const handlePasteUrlSubmit = (e) => {
    e.preventDefault()
    if (urlInput.trim()) {
      setJobDescription((prev) =>
        prev
          ? `${prev}\n\n[Imported from ${urlInput.trim()}]\nResponsibilities: Designing distributed microservices, optimizing APIs, collaborating with cross-functional product teams.`
          : `[Imported from ${urlInput.trim()}]\nLooking for an enthusiastic engineer with strong computer science fundamentals, system design proficiency, and agile development experience.`
      )
      setUrlInput('')
      setShowUrlModal(false)
    }
  }

  // AI Job Description Analysis Handler (Google ADK & OpenRouter)
  const triggerJdAnalysis = async () => {
    if (!jobDescription || !jobDescription.trim()) return
    setIsAnalyzingJd(true)
    setJdAnalysisError(null)

    try {
      const activeToken = authToken || localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const response = await fetch(`http://localhost:5000/api/interview/${id}/analyze-jd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          targetRole: targetRole.trim(),
          company: company.trim(),
          resumeAnalysis: resumeAnalysis || null,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success && data.jdAnalysis) {
        setJdAnalysis(data.jdAnalysis)
        if (!targetRole && data.jdAnalysis.role_understanding?.job_title) {
          setTargetRole(data.jdAnalysis.role_understanding.job_title)
        }
      } else {
        const errorMsg = data.message || 'Failed to analyze job description with AI service.'
        setJdAnalysisError(errorMsg)
      }
    } catch (err) {
      console.error('[NewInterview] JD Analysis error:', err)
      setJdAnalysisError('Could not reach backend or AI service. Please ensure the AI service is running.')
    } finally {
      setIsAnalyzingJd(false)
    }
  }

  // Sequential onboarding & calibration progress
  const hasResume = Boolean((uploadedResume && String(uploadedResume).trim()) || currentResumeFile)
  const isResumeInitiated = Boolean(hasResume || isAnalyzingResume)
  const hasResumeReady = Boolean(hasResume && resumeAnalysis && !analysisError)
  const hasRole = Boolean(targetRole && targetRole.trim())
  const hasCompany = Boolean(company && company.trim())
  const hasJd = Boolean(jobDescription && jobDescription.trim())
  const hasJdAnalysis = Boolean(jdAnalysis && !jdAnalysisError)
  const isJdInitiated = Boolean(hasJdAnalysis || isAnalyzingJd)

  // Sequential field locks:
  // When AI is analyzing the resume in background, allow user to fill target role, company, and JD without waiting!
  const isRoleLocked = !isResumeInitiated
  const isCompanyLocked = !isResumeInitiated || !hasRole
  const isJdLocked = !isResumeInitiated || !hasRole || !hasCompany
  // Options (Interview Type, Difficulty, Duration, GitHub) unlock after clicking "Analyze Job Description"
  const isOptionsLocked = isJdLocked || !hasJd || !isJdInitiated

  let completedStepsCount = 0
  if (hasResumeReady || isAnalyzingResume) completedStepsCount++
  if (hasRole) completedStepsCount++
  if (hasCompany) completedStepsCount++
  if (hasJdAnalysis || isAnalyzingJd) completedStepsCount++

  // 100% calibration only when all 4 steps are complete, resume analyzed, and JD analyzed
  const setupPercent = hasResumeReady && hasRole && hasCompany && hasJdAnalysis
    ? 100
    : Math.min(75, completedStepsCount * 25)
  const isSetupComplete = setupPercent === 100

  // 1: Resume -> 2: Role -> 3: Company -> 4: Job Description & Analysis -> 5: Options & Ready
  const currentStep = !isResumeInitiated
    ? 1
    : !hasRole
    ? 2
    : !hasCompany
    ? 3
    : !isJdInitiated
    ? 4
    : 5

  const stepDetails = isAnalyzingResume
    ? {
        badge: 'AI RESUME ANALYZING (BACKGROUND)',
        headline: !hasRole
          ? 'Enter Your Target Role'
          : !hasCompany
          ? 'Specify Your Target Company'
          : !hasJd
          ? 'Add Job Description'
          : 'Calibrating Session in Background...',
        subtext: 'Google ADK Resume Analyzer is extracting your skills in the background. You do not need to wait—feel free to fill Target Role, Company, and Job Description below!',
      }
    : isAnalyzingJd
    ? {
        badge: 'AI JD ANALYZING (BACKGROUND)',
        headline: 'Interview Options Unlocked!',
        subtext: 'The JD Analyzer Agent is evaluating employer expectations in the background. Options below are now unlocked—select your interview type, difficulty, and duration!',
      }
    : analysisError
    ? {
        badge: 'AI RESUME ERROR',
        headline: 'Resume Analysis Incomplete',
        subtext: analysisError,
      }
    : jdAnalysisError
    ? {
        badge: 'AI JD ERROR',
        headline: 'JD Analysis Incomplete',
        subtext: jdAnalysisError,
      }
    : {
        1: {
          badge: 'STEP 1 OF 4',
          headline: 'Upload Your Resume to Begin',
          subtext: 'Upload your resume (PDF or DOCX). Once selected, subsequent fields unlock immediately while analysis runs in the background.',
        },
        2: {
          badge: 'STEP 2 OF 4',
          headline: 'Enter Your Target Role',
          subtext: 'Specify the job position you are interviewing for (e.g. Backend Developer, Full Stack Engineer).',
        },
        3: {
          badge: 'STEP 3 OF 4',
          headline: 'Specify the Target Company',
          subtext: 'Enter the company name (e.g. Google, WSO2, Sysco) to calibrate behavioral & culture expectations.',
        },
        4: {
          badge: 'STEP 4 OF 4',
          headline: 'Add Job Description & Run Analysis',
          subtext: 'Paste job requirements and click "Analyze Job Description" to unlock interview configurations below.',
        },
        5: {
          badge: hasJdAnalysis ? 'CALIBRATION 100% COMPLETE' : 'OPTIONS UNLOCKED',
          headline: hasJdAnalysis ? 'Interview Cockpit Ready!' : 'Configure Your Interview',
          subtext: hasJdAnalysis
            ? 'All candidate configurations and JD alignment are complete. Click "Start" to begin your interactive AI interview.'
            : 'Select your preferred interview type, difficulty, duration, and GitHub integration below.',
        },
      }[currentStep]

  return (
    <div className="new-int-page">
      {/* Background Ambience */}
      <div className="new-int-bg" aria-hidden="true" />
      <div className="new-int-glow-orb new-int-glow-orb--top" aria-hidden="true" />
      <div className="new-int-glow-orb new-int-glow-orb--right" aria-hidden="true" />

      {/* =====================================================================
          TOP NAVIGATION BAR
          ===================================================================== */}
      <header className="new-int-nav">
        <div className="new-int-nav__left">
          <button
            type="button"
            className="new-int-nav__menu-btn"
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
            aria-label="Navigation Menu"
          >
            <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1.5H19M1 7.5H19M1 13.5H19" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="new-int-nav__title-group">
            <h1 className="new-int-nav__title">{targetRole ? targetRole : (company ? `${company} Interview` : 'New Interview')}</h1>
          </div>
        </div>

        <div className="new-int-nav__right">
          {/* Chatbot Toggle Button */}
          <button
            type="button"
            className={`new-int-nav__icon-btn ${isChatOpen ? 'is-active' : ''}`}
            onClick={() => setIsChatOpen((prev) => !prev)}
            title="AI Coach Assistant"
            aria-label="Toggle AI Coach"
          >
            <img src={chatbotIcon} alt="Chatbot" className="new-int-nav__bot-icon" />
          </button>

          {/* View Generated Plan Pill Button */}
          {planData && !showPlanView && (
            <button
              type="button"
              className="new-int-nav__plan-pill-btn"
              onClick={() => setShowPlanView(true)}
              title="View your personalized interview plan"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>View Plan</span>
            </button>
          )}

          {/* Share Button */}
          <button
            type="button"
            className="new-int-nav__share-btn"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href)
                alert('Interview session link copied to clipboard!')
              }
            }}
            title="Share session"
          >
            <span>Share</span>
            <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 4.5C12 5.60457 11.1046 6.5 10 6.5C8.89543 6.5 8 5.60457 8 4.5C8 3.39543 8.89543 2.5 10 2.5C11.1046 2.5 12 3.39543 12 4.5Z"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              <path
                d="M5 8.5C5 9.60457 4.10457 10.5 3 10.5C1.89543 10.5 1 9.60457 1 8.5C1 7.39543 1.89543 6.5 3 6.5C4.10457 6.5 5 7.39543 5 8.5Z"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              <path
                d="M12 12.5C12 13.6046 11.1046 14.5 10 14.5C8.89543 14.5 8 13.6046 8 12.5C8 11.3954 8.89543 10.5 10 10.5C11.1046 10.5 12 11.3954 12 12.5Z"
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              <path d="M4.75 7.6L8.25 5.4M4.75 9.4L8.25 11.6" stroke="#94A3B8" strokeWidth="1.5" />
            </svg>
          </button>

          {/* User Profile Dropdown */}
          <ProfileDropdown />
        </div>
      </header>

      {/* Mobile View Switcher Tabs (Shown on small viewports <= 850px) */}
      <div className="new-int-mobile-tabs">
        <button
          type="button"
          className={`new-int-mobile-tab ${activeMobileTab === 'setup' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('setup')}
        >
          Interview Setup
        </button>
        <button
          type="button"
          className={`new-int-mobile-tab ${activeMobileTab === 'gauge' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('gauge')}
        >
          Setup Guide
        </button>
        <button
          type="button"
          className={`new-int-mobile-tab ${activeMobileTab === 'pipeline' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('pipeline')}
        >
          AI Pipeline
        </button>
      </div>

      {/* =====================================================================
          INTERVIEW PLAN SCREEN (Rendered when plan is ready and user is reviewing)
          ===================================================================== */}
      {showPlanView && planData ? (
        <main className="new-int-plan-view-wrap">
          <div className="new-int-plan-card">
            {/* Header banner */}
            <div className="new-int-plan-header">
              <div className="new-int-plan-badge">
                <span className="new-int-plan-dot" />
                <span>PERSONALIZED INTERVIEW PLAN</span>
              </div>
              <h1 className="new-int-plan-title">Your Interview Plan</h1>
              <p className="new-int-plan-subtitle">
                Synthesized by the HireMind Planning Agent for{' '}
                <strong className="new-int-highlight">{planData.role || targetRole}</strong>
                {planData.company || company ? (
                  <>
                    {' '}at <strong className="new-int-highlight">{planData.company || company}</strong>
                  </>
                ) : null}
              </p>
            </div>

            {/* Quick meta pills bar */}
            <div className="new-int-plan-meta-grid">
              <div className="new-int-plan-meta-item">
                <span className="new-int-plan-meta-label">TARGET ROLE</span>
                <span className="new-int-plan-meta-val">{planData.role || targetRole || 'Software Engineer'}</span>
              </div>
              <div className="new-int-plan-meta-item">
                <span className="new-int-plan-meta-label">COMPANY</span>
                <span className="new-int-plan-meta-val">{planData.company || company || 'General Interview'}</span>
              </div>
              <div className="new-int-plan-meta-item">
                <span className="new-int-plan-meta-label">INTERVIEW TYPE</span>
                <span className="new-int-plan-meta-val">{planData.interviewType || interviewType}</span>
              </div>
              <div className="new-int-plan-meta-item">
                <span className="new-int-plan-meta-label">DIFFICULTY</span>
                <span className="new-int-plan-meta-val new-int-plan-meta-diff">{planData.difficulty || difficulty}</span>
              </div>
              <div className="new-int-plan-meta-item">
                <span className="new-int-plan-meta-label">TOTAL DURATION</span>
                <span className="new-int-plan-meta-val">{planData.duration || `${planData.durationMinutes || 30} minutes`}</span>
              </div>
              <div className="new-int-plan-meta-item">
                <span className="new-int-plan-meta-label">ESTIMATED QUESTIONS</span>
                <span className="new-int-plan-meta-val">~{planData.estimatedQuestionCount || 10} Questions</span>
              </div>
            </div>

            {/* Overarching Objectives (if any) */}
            {planData.objectives && planData.objectives.length > 0 && (
              <div className="new-int-plan-section">
                <div className="new-int-plan-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <span>Key Evaluation Objectives</span>
                </div>
                <div className="new-int-plan-objectives-grid">
                  {planData.objectives.map((obj, i) => (
                    <div key={i} className="new-int-plan-obj-item">
                      <span className="new-int-plan-obj-check">✓</span>
                      <span>{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stages Sequence */}
            <div className="new-int-plan-section">
              <div className="new-int-plan-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span>Planned Interview Stages</span>
                <span className="new-int-plan-stages-count">({planData.stages?.length || 0} Stages)</span>
              </div>

              <div className="new-int-plan-stages-list">
                {(planData.stages || []).map((stage, idx) => (
                  <div key={stage.id || idx} className="new-int-plan-stage-row">
                    <div className="new-int-plan-stage-num">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="new-int-plan-stage-main">
                      <div className="new-int-plan-stage-head">
                        <h3 className="new-int-plan-stage-name">{stage.name}</h3>
                        <span className="new-int-plan-stage-duration">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {stage.duration || `${stage.durationMinutes} min`}
                        </span>
                      </div>
                      {stage.topics && stage.topics.length > 0 && (
                        <div className="new-int-plan-stage-topics">
                          {stage.topics.map((t, ti) => (
                            <span key={ti} className="new-int-plan-topic-pill">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Footer Action Bar */}
            <div className="new-int-plan-actions">
              <button
                type="button"
                className="new-int-plan-back-btn"
                onClick={() => setShowPlanView(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Edit Setup</span>
              </button>

              <button
                type="button"
                className="new-int-plan-begin-btn"
                onClick={handleBeginInterview}
              >
                <span>Begin Interview</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* =====================================================================
            MAIN WORKSPACE (3 Columns: Setup, Sequential Guide HUD, Pipeline)
            ===================================================================== */
        <div className="new-int-workspace">
        {/* ===================================================================
            COLUMN 1: Left Setup Panel & Session Controls
            =================================================================== */}
        <section
          className={`new-int-col new-int-col--setup ${
            activeMobileTab === 'setup' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          {/* Configuration Form Card */}
          <div className="new-int-card">
            {/* SIGNUP RESUME DETECTED BANNER */}
            {authUser?.resumeFileName && !uploadedResume && !useProfileResumeChoiceDismissed && (
              <div className="new-int-profile-resume-card">
                <div className="new-int-profile-resume-top">
                  <span className="new-int-profile-resume-dot" />
                  <span className="new-int-profile-resume-badge">SIGNUP RESUME DETECTED</span>
                </div>
                <div className="new-int-profile-resume-msg">
                  You uploaded <strong>{authUser.resumeFileName.replace(/^resumes\//, '')}</strong> during signup.
                  <br />
                  Would you like to analyze this resume or upload another?
                </div>
                <div className="new-int-profile-resume-actions-layout">
                  {/* Line 1: Full-width View Resume button */}
                  <button
                    type="button"
                    className="new-int-btn-profile-view new-int-btn-profile-view--full"
                    onClick={handleViewProfileResume}
                    title="View uploaded signup resume in a new tab"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>View Resume</span>
                  </button>

                  {/* Line 2: Use This Resume and Upload Another side-by-side */}
                  <div className="new-int-profile-resume-row">
                    <button
                      type="button"
                      className="new-int-btn-profile-use"
                      onClick={() => triggerResumeAnalysis(null, true)}
                      disabled={isAnalyzingResume}
                    >
                      {isAnalyzingResume ? 'Analyzing...' : 'Use This Resume'}
                    </button>
                    <button
                      type="button"
                      className="new-int-btn-profile-other"
                      onClick={() => {
                        setUseProfileResumeChoiceDismissed(true)
                        fileInputRef.current?.click()
                      }}
                      disabled={isAnalyzingResume}
                    >
                      Upload Another
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SELECTED RESUME */}
            <div className="new-int-field-group">
              <label className="new-int-label">SELECTED RESUME</label>
              <div
                className={`new-int-dropzone ${isAnalyzingResume ? 'is-analyzing' : ''} ${uploadedResume ? 'is-uploaded' : ''}`}
                onClick={() => !uploadedResume && !isAnalyzingResume && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  disabled={isAnalyzingResume}
                />
                {isAnalyzingResume ? (
                  <div className="new-int-dropzone__loading">
                    <img src={jdSkillsIcon} alt="" className="new-int-pipe-icon--spin" width="26" height="26" />
                    <div className="new-int-dropzone__title">Analyzing Resume with AI Agent...</div>
                    <div className="new-int-dropzone__sub">Google ADK Agent extracting profile & skills</div>
                    <div className="new-int-dropzone__progress">
                      <div className="new-int-dropzone__bar" />
                    </div>
                  </div>
                ) : uploadedResume ? (
                  <div className="new-int-dropzone__actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="new-int-dropzone__view-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (currentResumeFile) {
                          const blobUrl = URL.createObjectURL(currentResumeFile)
                          window.open(blobUrl, '_blank', 'noopener,noreferrer')
                        } else {
                          handleViewProfileResume(e)
                        }
                      }}
                      title="View resume document in a new tab"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>View Resume Document</span>
                    </button>
                    <button
                      type="button"
                      className="new-int-dropzone__remove-btn"
                      onClick={handleRemoveResume}
                      title="Remove selected resume"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <span>Remove CV</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <img src={attachmentIcon} alt="" className="new-int-dropzone__icon" />
                    <div className="new-int-dropzone__title">Upload Resume</div>
                    <div className="new-int-dropzone__sub">
                      Drag & Drop or Click to Browse (PDF, DOCX)
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* TARGET ROLE */}
            <div className={`new-int-field-group ${isRoleLocked ? 'is-locked' : ''}`}>
              <div className="new-int-label-row">
                <label htmlFor="target-role" className="new-int-label">
                  TARGET ROLE
                </label>
                {isRoleLocked && (
                  <span className="new-int-locked-tag">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Upload CV first</span>
                  </span>
                )}
              </div>
              <input
                id="target-role"
                type="text"
                className={`new-int-input ${isRoleLocked ? 'is-disabled' : ''}`}
                placeholder={isRoleLocked ? 'Upload CV above to unlock target role...' : 'e.g. Backend Developer / Software Engineer'}
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                disabled={isRoleLocked}
              />
            </div>

            {/* COMPANY */}
            <div className={`new-int-field-group ${isCompanyLocked ? 'is-locked' : ''}`}>
              <div className="new-int-label-row">
                <label htmlFor="company-name" className="new-int-label">
                  COMPANY
                </label>
                {isCompanyLocked && (
                  <span className="new-int-locked-tag">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Fill target role first</span>
                  </span>
                )}
              </div>
              <input
                id="company-name"
                type="text"
                className={`new-int-input ${isCompanyLocked ? 'is-disabled' : ''}`}
                placeholder={isCompanyLocked ? 'Enter target role above to unlock...' : 'eg: WSO2'}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={isCompanyLocked}
              />
            </div>

            {/* JOB DESCRIPTION */}
            <div className={`new-int-field-group ${isJdLocked ? 'is-locked' : ''}`}>
              <div className="new-int-label-row">
                <label htmlFor="job-desc" className="new-int-label">
                  JOB DESCRIPTION
                </label>
                {isJdLocked ? (
                  <span className="new-int-locked-tag">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Fill company first</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="new-int-paste-link"
                    onClick={() => setShowUrlModal(true)}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M8.5 2.5L13.5 7.5L6.5 14.5L1.5 9.5L8.5 2.5Z"
                        stroke="#38BDF8"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <path d="M11 5L5 11" stroke="#38BDF8" strokeWidth="1.5" />
                    </svg>
                    <span>Paste URL</span>
                  </button>
                )}
              </div>
              <textarea
                id="job-desc"
                className={`new-int-textarea ${isJdLocked ? 'is-disabled' : ''}`}
                rows="4"
                placeholder={isJdLocked ? 'Fill previous steps to unlock job description...' : 'Paste full job description, responsibilities, and requirements here...'}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                disabled={isJdLocked}
              />

              {/* JD Analyzer Action Row & Trigger Button */}
              {!isJdLocked && (
                <div className="new-int-jd-action-row">
                  <button
                    type="button"
                    className={`new-int-analyze-jd-btn ${isAnalyzingJd ? 'is-analyzing' : ''} ${hasJdAnalysis ? 'is-analyzed' : ''}`}
                    onClick={triggerJdAnalysis}
                    disabled={!jobDescription.trim() || isAnalyzingJd}
                    title={!jobDescription.trim() ? 'Paste a job description first' : 'Analyze with Job Description Analyzer Agent'}
                  >
                    {isAnalyzingJd ? (
                      <>
                        <span className="new-int-analyze-spinner" />
                        <span>Analyzing with JD Agent...</span>
                      </>
                    ) : hasJdAnalysis ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Re-Analyze Job Description</span>
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          <path d="M11 8v6M8 11h6" />
                        </svg>
                        <span>Analyze Job Description</span>
                      </>
                    )}
                  </button>

                  {hasJdAnalysis && (
                    <span className="new-int-jd-status-badge">
                      <span className="new-int-jd-status-dot" />
                      JD Analyzed
                    </span>
                  )}
                </div>
              )}

              {/* JD Analysis Error Alert */}
              {jdAnalysisError && (
                <div className="new-int-jd-error-banner">
                  <div className="new-int-jd-error-text">
                    <strong>JD Analyzer Warning:</strong> {jdAnalysisError}
                  </div>
                  <button
                    type="button"
                    className="new-int-jd-retry-btn"
                    onClick={triggerJdAnalysis}
                    disabled={isAnalyzingJd}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Compact Role Fit Card (Full analysis saved in DB for interview) */}
              {hasJdAnalysis && jdAnalysis && (
                <div className="new-int-role-fit-card">
                  <div className="new-int-role-fit-row">
                    <div className="new-int-role-fit-details">
                      <div className="new-int-role-fit-badge-row">
                        <span className="new-int-role-fit-tag">Role Fit</span>
                        {jdAnalysis.role_understanding?.seniority_level && (
                          <span className="new-int-role-fit-level">
                            {jdAnalysis.role_understanding.seniority_level}
                          </span>
                        )}
                        <span className="new-int-role-fit-saved-pill">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Saved for Interview
                        </span>
                      </div>
                      <div className="new-int-role-fit-role-title">
                        {jdAnalysis.role_understanding?.job_title || targetRole || 'Target Role'}
                      </div>
                    </div>

                    <div className="new-int-role-fit-score-box">
                      <div className="new-int-role-fit-score-val">
                        {jdAnalysis.candidate_alignment?.match_percentage_estimate ?? jdAnalysis.candidate_alignment?.match_percentage ?? 80}%
                      </div>
                      <div className="new-int-role-fit-score-lbl">MATCH</div>
                    </div>
                  </div>

                  <div className="new-int-role-fit-progress-wrap">
                    <div
                      className="new-int-role-fit-progress-bar"
                      style={{
                        width: `${Math.min(100, Math.max(0, jdAnalysis.candidate_alignment?.match_percentage_estimate ?? jdAnalysis.candidate_alignment?.match_percentage ?? 80))}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* INTERVIEW TYPE */}
            <div className={`new-int-field-group ${isOptionsLocked ? 'is-locked' : ''}`}>
              <div className="new-int-label-row">
                <label className="new-int-label">INTERVIEW TYPE</label>
                {isOptionsLocked && (
                  <span className="new-int-locked-tag">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Analyze JD first</span>
                  </span>
                )}
              </div>
              <div className="new-int-pills-row new-int-pills-row--types">
                {[
                  'HR & Behavioral',
                  'Role-Specific',
                  'Case & Situational',
                  'Skills Assessment',
                  'Full Interview',
                ].map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={isOptionsLocked}
                    className={`new-int-pill ${interviewType === type ? 'is-active' : ''} ${isOptionsLocked ? 'is-disabled' : ''}`}
                    onClick={() => setInterviewType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* DIFFICULTY */}
            <div className={`new-int-field-group ${isOptionsLocked ? 'is-locked' : ''}`}>
              <div className="new-int-label-row">
                <label className="new-int-label">DIFFICULTY</label>
                {isOptionsLocked && (
                  <span className="new-int-locked-tag">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Analyze JD first</span>
                  </span>
                )}
              </div>
              <div className="new-int-pills-row">
                {['Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    disabled={isOptionsLocked}
                    className={`new-int-pill ${difficulty === diff ? 'is-active' : ''} ${isOptionsLocked ? 'is-disabled' : ''}`}
                    onClick={() => setDifficulty(diff)}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* DURATION */}
            <div className={`new-int-field-group ${isOptionsLocked ? 'is-locked' : ''}`}>
              <div className="new-int-label-row">
                <label className="new-int-label">DURATION</label>
                {isOptionsLocked && (
                  <span className="new-int-locked-tag">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Analyze JD first</span>
                  </span>
                )}
              </div>
              <div className="new-int-pills-row">
                {['15 min', '30 min', '60 min'].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    disabled={isOptionsLocked}
                    className={`new-int-pill ${duration === dur ? 'is-active' : ''} ${isOptionsLocked ? 'is-disabled' : ''}`}
                    onClick={() => setDuration(dur)}
                  >
                    {dur}
                  </button>
                ))}
              </div>
            </div>

            {/* GITHUB INTEGRATION (Shown for developer/technical roles, marked Optional) */}
            {showGithubOption && (
              <div className={`new-int-github-card ${isGithubConnected ? 'is-connected' : ''} ${isOptionsLocked ? 'is-locked' : ''}`}>
                <div className="new-int-github-info">
                  <div className="new-int-github-icon-wrap">
                    <svg className="new-int-github-icon" width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  </div>
                  <div className="new-int-github-text">
                    <div className="new-int-github-title-row">
                      <span className="new-int-github-name">GitHub</span>
                      <span className="new-int-github-optional-tag">Optional</span>
                      {isOptionsLocked && (
                        <span className="new-int-locked-tag">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <span>Analyze JD first</span>
                        </span>
                      )}
                    </div>
                    <span
                      className="new-int-github-sub"
                      title={isProfileGithubConnected && isGithubConnected ? `@${profileGithubUsername} • ${profileGithubReposCount} repos synced` : ''}
                    >
                      {isProfileGithubConnected && isGithubConnected
                        ? `@${profileGithubUsername || 'connected'} • ${profileGithubReposCount} repos`
                        : isProfileGithubConnected && !isGithubConnected
                        ? `@${profileGithubUsername} (Disabled)`
                        : 'Connect repos for code context'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isOptionsLocked}
                  className={`new-int-github-btn ${isGithubConnected ? 'is-connected' : ''} ${isOptionsLocked ? 'is-disabled' : ''}`}
                  onClick={handleGithubButtonClick}
                  title={
                    isOptionsLocked
                      ? 'Analyze Job Description above first'
                      : isProfileGithubConnected
                      ? isGithubConnected
                        ? 'Click to disable GitHub repos for this interview'
                        : 'Click to enable your connected GitHub repos'
                      : 'Connect your GitHub account'
                  }
                >
                  {isGithubConnected ? (
                    <>
                      <span className="new-int-github-dot" />
                      CONNECTED
                    </>
                  ) : isProfileGithubConnected ? (
                    'ENABLE'
                  ) : (
                    'CONNECT'
                  )}
                </button>
              </div>
            )}

            {/* START INTERVIEW ACTION (Placed below GitHub) */}
            <button
              type="button"
              className={`new-int-card-start-btn ${isRecording ? 'is-active' : ''} ${isAnalyzingResume || isAnalyzingJd || isPlanning || isOptionsLocked || !isSetupComplete ? 'is-disabled' : ''} ${planData ? 'is-plan-ready' : ''}`}
              onClick={handleStartToggle}
              disabled={isAnalyzingResume || isAnalyzingJd || isPlanning || isOptionsLocked || !isSetupComplete}
              title={
                isAnalyzingResume
                  ? 'Analyzing resume with AI agent... Start unlocks once analysis completes'
                  : isAnalyzingJd
                  ? 'Analyzing job description with AI agent... Start unlocks once analysis completes'
                  : isOptionsLocked
                  ? 'Analyze Job Description above to unlock remaining options'
                  : isPlanning
                  ? 'Preparing your personalized interview plan...'
                  : !isSetupComplete
                  ? 'Complete all setup steps to enable Start'
                  : planData
                  ? 'View your personalized interview plan'
                  : 'Start Interview'
              }
            >
              {isPlanning ? (
                <>
                  <span className="new-int-analyze-spinner" />
                  <span>Preparing Plan...</span>
                </>
              ) : isAnalyzingResume ? (
                <>
                  <span className="new-int-analyze-spinner" />
                  <span>Parsing Resume...</span>
                </>
              ) : isAnalyzingJd ? (
                <>
                  <span className="new-int-analyze-spinner" />
                  <span>Analyzing JD...</span>
                </>
              ) : planData ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>View Interview Plan</span>
                </>
              ) : isRecording ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  <span>Pause Interview</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Start Interview</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 2: Center Interactive HUD & Sequential Calibration Progress
            =================================================================== */}
        <section
          className={`new-int-col new-int-col--hud ${
            activeMobileTab === 'gauge' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          <div className="new-int-hud-panel">
            {/* Top Interactive Banner / Stage Indicator */}
            <div className="new-int-hud-banner">
              <span className="new-int-hud-badge">
                <span className="new-int-hud-dot" />
                {stepDetails.badge}
              </span>
              <h2 className="new-int-hud-headline">{stepDetails.headline}</h2>
              <p className="new-int-hud-subtext">{stepDetails.subtext}</p>
            </div>

            {/* Circular Progress Gauge */}
            <div className="new-int-hud-gauge-wrap">
              <div className={`new-int-hud-circle ${isSetupComplete ? 'is-ready' : ''}`}>
                <svg className="new-int-hud-svg" viewBox="0 0 200 200">
                  {/* Track circle */}
                  <circle
                    className="new-int-hud-bg-ring"
                    cx="100"
                    cy="100"
                    r="86"
                    fill="none"
                    strokeWidth="8"
                  />
                  {/* Progress stroke */}
                  <circle
                    className="new-int-hud-meter-ring"
                    cx="100"
                    cy="100"
                    r="86"
                    fill="none"
                    strokeWidth="8"
                    strokeDasharray={540}
                    strokeDashoffset={540 - (540 * setupPercent) / 100}
                  />
                </svg>

                <div className="new-int-hud-center">
                  <div className="new-int-hud-percent">{setupPercent}%</div>
                  <div className="new-int-hud-status-label">
                    {isPlanning
                      ? 'PREPARING PLAN...'
                      : isAnalyzingResume
                      ? 'ANALYZING...'
                      : analysisError
                      ? 'ACTION NEEDED'
                      : planData
                      ? 'PLAN READY'
                      : isSetupComplete
                      ? 'READY TO START'
                      : `${completedStepsCount} of 4 complete`}
                  </div>

                  <button
                    type="button"
                    className="new-int-hud-start-btn"
                    onClick={handleStartToggle}
                    disabled={isAnalyzingResume || isAnalyzingJd || isPlanning || isOptionsLocked || !isSetupComplete}
                    title={
                      isPlanning
                        ? 'Preparing your personalized interview plan...'
                        : isAnalyzingResume
                        ? 'Analyzing resume with AI agent...'
                        : isAnalyzingJd
                        ? 'Analyzing job description with AI agent...'
                        : isOptionsLocked
                        ? 'Analyze Job Description above to unlock remaining options'
                        : analysisError
                        ? 'Please resolve resume analysis error to enable Start'
                        : !isSetupComplete
                        ? 'Complete all setup steps to enable Start'
                        : planData
                        ? 'View your personalized interview plan'
                        : 'Start Interview'
                    }
                  >
                    {isPlanning
                      ? 'PREPARING...'
                      : isAnalyzingResume
                      ? 'PARSING...'
                      : isAnalyzingJd
                      ? 'ANALYZING JD...'
                      : planData
                      ? 'VIEW PLAN'
                      : 'START INTERVIEW'}
                  </button>
                </div>
              </div>
            </div>

            {/* Sequential Steps Track with Interactive Click Triggers */}
            <div className="new-int-steps-track">
              {/* Step 1: Upload Resume */}
              <div
                className={`new-int-step-item ${hasResumeReady ? 'is-done' : isAnalyzingResume ? 'is-active' : analysisError ? 'is-error' : currentStep === 1 ? 'is-active' : ''}`}
                onClick={() => !isAnalyzingResume && fileInputRef.current?.click()}
                title="Step 1: Upload Resume"
              >
                <div className="new-int-step-num">{hasResumeReady ? '✓' : isAnalyzingResume ? '⚡' : analysisError ? '!' : '1'}</div>
                <div className="new-int-step-text">
                  <div className="new-int-step-title">1. Upload Resume</div>
                  <div className="new-int-step-sub">
                    {isAnalyzingResume
                      ? 'Analyzing in background • Fill fields below'
                      : analysisError
                      ? 'Analysis error — click to retry or change file'
                      : hasResumeReady
                      ? uploadedResume
                      : 'Click to select or drag PDF / DOCX'}
                  </div>
                </div>
              </div>

              {/* Step 2: Target Role */}
              <div
                className={`new-int-step-item ${hasRole ? 'is-done' : currentStep === 2 ? 'is-active' : ''}`}
                onClick={() => document.getElementById('target-role')?.focus()}
                title="Step 2: Enter Target Role"
              >
                <div className="new-int-step-num">{hasRole ? '✓' : '2'}</div>
                <div className="new-int-step-text">
                  <div className="new-int-step-title">2. Target Role</div>
                  <div className="new-int-step-sub">
                    {hasRole ? targetRole : 'Specify position (e.g. Backend Developer)'}
                  </div>
                </div>
              </div>

              {/* Step 3: Company */}
              <div
                className={`new-int-step-item ${hasCompany ? 'is-done' : currentStep === 3 ? 'is-active' : ''}`}
                onClick={() => document.getElementById('company-name')?.focus()}
                title="Step 3: Enter Company Name"
              >
                <div className="new-int-step-num">{hasCompany ? '✓' : '3'}</div>
                <div className="new-int-step-text">
                  <div className="new-int-step-title">3. Company Name</div>
                  <div className="new-int-step-sub">
                    {hasCompany ? company : 'Company name (e.g. WSO2, Google)'}
                  </div>
                </div>
              </div>

              {/* Step 4: Job Description & Analysis */}
              <div
                className={`new-int-step-item ${hasJdAnalysis ? 'is-done' : isAnalyzingJd ? 'is-active' : jdAnalysisError ? 'is-error' : currentStep === 4 ? 'is-active' : ''}`}
                onClick={() => document.getElementById('job-desc')?.focus()}
                title="Step 4: Job Description & Analysis"
              >
                <div className="new-int-step-num">{hasJdAnalysis ? '✓' : isAnalyzingJd ? '⚡' : jdAnalysisError ? '!' : '4'}</div>
                <div className="new-int-step-text">
                  <div className="new-int-step-title">4. Job Description & AI Analysis</div>
                  <div className="new-int-step-sub">
                    {isAnalyzingJd
                      ? 'JD Analyzer Agent evaluating requirements...'
                      : hasJdAnalysis
                      ? `Analysis complete • ${jdAnalysis?.candidate_alignment?.match_percentage_estimate ?? jdAnalysis?.candidate_alignment?.match_percentage ?? 80}% candidate fit`
                      : jdAnalysisError
                      ? 'Analysis error — click retry above'
                      : hasJd
                      ? 'JD pasted — click "Analyze Job Description"'
                      : 'Paste JD or import via URL'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 3: Right Pipeline Status Cards
            =================================================================== */}
        <section
          className={`new-int-col new-int-col--pipeline ${
            activeMobileTab === 'pipeline' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          <div className="new-int-pipeline-list">
            {/* Stage 1: Parsing Resume & Experience */}
            <div
              className={`new-int-pipe-card ${
                isAnalyzingResume
                  ? 'new-int-pipe-card--active'
                  : analysisError
                  ? 'new-int-pipe-card--error'
                  : hasResumeReady
                  ? 'new-int-pipe-card--done'
                  : 'new-int-pipe-card--queued'
              }`}
            >
              <div className="new-int-pipe-card__main-row">
                <div className="new-int-pipe-card__left">
                  <div
                    className={`new-int-pipe-card__icon-wrap ${
                      isAnalyzingResume
                        ? 'is-analyzing'
                        : analysisError
                        ? 'is-error'
                        : hasResumeReady
                        ? 'is-done'
                        : 'is-queued'
                    }`}
                  >
                    {analysisError && !isAnalyzingResume ? (
                      <span className="new-int-pipe-card__err-icon">✕</span>
                    ) : (
                      <img
                        src={isAnalyzingResume ? jdSkillsIcon : tick2Icon}
                        alt=""
                        className={`new-int-pipe-icon ${isAnalyzingResume ? 'new-int-pipe-icon--spin' : ''}`}
                      />
                    )}
                  </div>
                  <div className="new-int-pipe-card__title">
                    Parsing Resume & Experience
                    {analysisError && !isAnalyzingResume ? (
                      <div className="new-int-pipe-error-preview">
                        AI Service Unreachable / Failed
                      </div>
                    ) : hasResumeReady && resumeAnalysis?.skills?.technical?.length > 0 && !isAnalyzingResume ? (
                      <div className="new-int-pipe-skills-preview">
                        {resumeAnalysis.skills.technical.slice(0, 3).join(' • ')}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div
                  className={`new-int-pipe-badge ${
                    isAnalyzingResume
                      ? 'new-int-pipe-badge--analyzing'
                      : analysisError
                      ? 'new-int-pipe-badge--error'
                      : hasResumeReady
                      ? 'new-int-pipe-badge--done'
                      : 'new-int-pipe-badge--queued'
                  }`}
                >
                  {isAnalyzingResume ? 'ANALYZING' : analysisError ? 'ERROR' : hasResumeReady ? 'DONE' : 'WAITING'}
                </div>
              </div>

              {isAnalyzingResume && (
                <div className="new-int-progress-bar">
                  <div className="new-int-progress-fill is-pulsing" style={{ width: '75%' }} />
                </div>
              )}
            </div>

            {/* Stage 2: Extracting Key Skills from JD */}
            <div
              className={`new-int-pipe-card ${
                isAnalyzingJd
                  ? 'new-int-pipe-card--active'
                  : jdAnalysisError
                  ? 'new-int-pipe-card--error'
                  : hasJdAnalysis
                  ? 'new-int-pipe-card--done'
                  : hasJd
                  ? 'new-int-pipe-card--ready'
                  : 'new-int-pipe-card--queued'
              }`}
            >
              <div className="new-int-pipe-card__main-row">
                <div className="new-int-pipe-card__left">
                  <div
                    className={`new-int-pipe-card__icon-wrap ${
                      isAnalyzingJd
                        ? 'is-analyzing'
                        : jdAnalysisError
                        ? 'is-error'
                        : hasJdAnalysis
                        ? 'is-done'
                        : 'is-queued'
                    }`}
                  >
                    {jdAnalysisError && !isAnalyzingJd ? (
                      <span className="new-int-pipe-card__err-icon">✕</span>
                    ) : (
                      <img
                        src={hasJdAnalysis ? tick2Icon : jdSkillsIcon}
                        alt=""
                        className={`new-int-pipe-icon ${isAnalyzingJd ? 'new-int-pipe-icon--spin' : ''}`}
                      />
                    )}
                  </div>
                  <div className="new-int-pipe-card__title">
                    Extracting Key Skills
                    <br />
                    from JD
                    {hasJdAnalysis && jdAnalysis?.requirements?.required_skills?.length > 0 && !isAnalyzingJd ? (
                      <div className="new-int-pipe-skills-preview">
                        {jdAnalysis.requirements.required_skills.slice(0, 3).join(' • ')}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div
                  className={`new-int-pipe-badge ${
                    isAnalyzingJd
                      ? 'new-int-pipe-badge--analyzing'
                      : jdAnalysisError
                      ? 'new-int-pipe-badge--error'
                      : hasJdAnalysis
                      ? 'new-int-pipe-badge--done'
                      : hasJd
                      ? 'new-int-pipe-badge--active'
                      : 'new-int-pipe-badge--queued'
                  }`}
                >
                  {isAnalyzingJd
                    ? 'ANALYZING'
                    : jdAnalysisError
                    ? 'ERROR'
                    : hasJdAnalysis
                    ? 'DONE'
                    : hasJd
                    ? 'READY'
                    : 'QUEUED'}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="new-int-progress-bar">
                <div
                  className={`new-int-progress-fill ${isAnalyzingJd ? 'is-pulsing' : ''}`}
                  style={{ width: hasJdAnalysis ? '100%' : isAnalyzingJd ? '60%' : hasJd ? '30%' : '0%' }}
                />
              </div>
            </div>

            {/* Stage 3: Researching Engineering Culture */}
            <div className={`new-int-pipe-card ${hasCompany ? 'new-int-pipe-card--done' : 'new-int-pipe-card--queued'}`}>
              <div className="new-int-pipe-card__left">
                <div className={`new-int-pipe-card__icon-wrap ${hasCompany ? 'is-done' : 'is-queued'}`}>
                  <img src={hasCompany ? tick2Icon : researchEngIcon} alt="" className="new-int-pipe-icon" />
                </div>
                <div className="new-int-pipe-card__title">
                  Researching Engineering
                  <br />
                  Culture
                </div>
              </div>
              <div className={`new-int-pipe-badge ${hasCompany ? 'new-int-pipe-badge--done' : 'new-int-pipe-badge--queued'}`}>
                {hasCompany ? 'DONE' : 'QUEUED'}
              </div>
            </div>

            {/* Stage 4: Interview Planning Agent */}
            <div className={`new-int-pipe-card ${planData ? 'new-int-pipe-card--done' : isPlanning ? 'new-int-pipe-card--active' : isSetupComplete ? 'new-int-pipe-card--active' : 'new-int-pipe-card--queued'}`}>
              <div className="new-int-pipe-card__left">
                <div className={`new-int-pipe-card__icon-wrap ${planData ? 'is-done' : isPlanning || isSetupComplete ? 'is-analyzing' : 'is-queued'}`}>
                  <img src={planData ? tick2Icon : genQuestionsIcon} alt="" className="new-int-pipe-icon" />
                </div>
                <div className="new-int-pipe-card__title">
                  Interview Planning
                  <br />
                  Agent
                </div>
              </div>
              <div className={`new-int-pipe-badge ${planData ? 'new-int-pipe-badge--done' : isPlanning ? 'new-int-pipe-badge--analyzing' : isSetupComplete ? 'new-int-pipe-badge--analyzing' : 'new-int-pipe-badge--queued'}`}>
                {planData ? 'PLAN READY' : isPlanning ? 'PLANNING...' : isSetupComplete ? 'READY' : 'QUEUED'}
              </div>
            </div>
          </div>
        </section>
      </div>
      )}

      {/* PROFESSIONAL PLANNING LOADING MODAL */}
      {isPlanning && (
        <div className="new-int-planning-modal-backdrop" role="dialog" aria-modal="true">
          <div className="new-int-planning-modal-card">
            <div className="new-int-planning-orb-wrap">
              <div className="new-int-planning-spinner-ring" />
              <div className="new-int-planning-core-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
            </div>
            <h3 className="new-int-planning-title">Preparing Your Personalized Interview</h3>
            <p className="new-int-planning-subtext">{planningMessage}</p>
            <div className="new-int-planning-progress-line">
              <div className="new-int-planning-progress-glow" />
            </div>
            <span className="new-int-planning-agent-tag">
              <span className="new-int-planning-pulse-dot" />
              HIREMIND PLANNING AGENT ACTIVE
            </span>
          </div>
        </div>
      )}

      {/* PLAN ERROR BANNER */}
      {planError && (
        <div className="new-int-plan-error-banner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="new-int-plan-error-text">{planError}</div>
          <button type="button" className="new-int-plan-error-dismiss" onClick={() => setPlanError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* URL Import Modal */}
      {showUrlModal && (
        <div className="new-int-modal-backdrop" onClick={() => setShowUrlModal(false)}>
          <div className="new-int-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="new-int-modal__title">Import Job Description from URL</h3>
            <p className="new-int-modal__desc">
              Paste the public job posting link (e.g. LinkedIn, Indeed, Company Careers).
            </p>
            <form onSubmit={handlePasteUrlSubmit}>
              <input
                type="url"
                required
                placeholder="https://company.com/careers/software-engineer"
                className="new-int-input new-int-modal__input"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                autoFocus
              />
              <div className="new-int-modal__actions">
                <button
                  type="button"
                  className="new-int-modal__cancel-btn"
                  onClick={() => setShowUrlModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="new-int-modal__submit-btn">
                  Fetch & Populate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GitHub Connect Modal (When user has not connected GitHub in profile) */}
      {showGithubModal && (
        <div className="new-int-modal-backdrop" onClick={() => !isConnectingGithub && setShowGithubModal(false)}>
          <div className="new-int-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="new-int-modal__title">Connect Your GitHub Account</h3>
            <p className="new-int-modal__desc">
              Enter your GitHub username or profile URL to link your repositories for this interview and sync them with your HireMind profile.
            </p>
            {githubModalError && (
              <div className="new-int-modal-error">
                {githubModalError}
              </div>
            )}
            <form onSubmit={handleConnectGithubSubmit}>
              <input
                type="text"
                required
                placeholder="e.g. jazeeljaufer or https://github.com/username"
                className="new-int-input new-int-modal__input"
                value={githubModalInput}
                onChange={(e) => setGithubModalInput(e.target.value)}
                autoFocus
                disabled={isConnectingGithub}
              />
              <div className="new-int-modal__actions">
                <button
                  type="button"
                  className="new-int-modal__cancel-btn"
                  onClick={() => setShowGithubModal(false)}
                  disabled={isConnectingGithub}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="new-int-modal__submit-btn"
                  disabled={isConnectingGithub}
                >
                  {isConnectingGithub ? 'Connecting Repos...' : 'Connect & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating AI Chat Assistant Drawer (When Chatbot icon clicked) */}
      {isChatOpen && (
        <div className="new-int-chat-drawer">
          <div className="new-int-chat-header">
            <div className="new-int-chat-title">
              <img src={chatbotIcon} alt="" className="new-int-chat-bot-icon" />
              <span>HireMind AI Coach</span>
            </div>
            <button
              type="button"
              className="new-int-chat-close"
              onClick={() => setIsChatOpen(false)}
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>
          <div className="new-int-chat-body">
            <div className="new-int-chat-bubble bot">
              I am configuring your customized mock session for <strong>Software Engineer Intern</strong>. When you are ready, tap <strong>Start</strong> to begin simulated audio questions!
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
