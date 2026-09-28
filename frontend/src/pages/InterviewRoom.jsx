import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import recordingDotIcon from '../assets/icons/recording.svg'
import callHangupIcon from '../assets/icons/call.svg'
import videoIcon from '../assets/icons/video.svg'
import audioIcon from '../assets/icons/audio.svg'
import attachmentIcon from '../assets/icons/attachment.svg'
import sendIcon from '../assets/icons/send.svg'
import tick2Icon from '../assets/icons/tick2.svg'
import company1Icon from '../assets/icons/company1.svg'
import chatbotIcon from '../assets/icons/chatbot.svg'
import ProfileDropdown from '../components/ProfileDropdown'
import { useAuth } from '../context/AuthContext'
import { getInterviewSession, saveInterviewSession } from '../utils/interviewUtils'
import './InterviewRoom.css'

export default function InterviewRoom() {
  const navigate = useNavigate()
  const { token, id } = useParams()
  const interviewId = id || token || 'default'
  const { user } = useAuth()

  // Track dynamic session details
  const [session, setSession] = useState(() => getInterviewSession(interviewId) || {})
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  useEffect(() => {
    if (!interviewId || interviewId === 'default') {
      setIsLoadingSession(false)
      return
    }

    // 1. Load from local cache first
    const local = getInterviewSession(interviewId)
    if (local) {
      setSession(local)
    }

    // 2. Fetch fresh dynamic data from backend API
    const fetchRemoteSession = async () => {
      try {
        const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
        const res = await fetch(`http://localhost:5000/api/interview/${interviewId}`, {
          headers: {
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.session) {
            setSession((prev) => ({ ...prev, ...data.session }))
            saveInterviewSession(data.session)
          }
        }
      } catch (err) {
        console.warn('[InterviewRoom] Remote session fetch notice:', err)
      } finally {
        setIsLoadingSession(false)
      }
    }

    fetchRemoteSession()

    // Update last visited path in storage so clicking from dashboard returns here
    saveInterviewSession({
      id: interviewId,
      status: 'in_progress',
      lastVisitedPath: `/new-interview/${interviewId}/room`,
    })
  }, [interviewId])

  const candidateInitial = user?.firstName?.trim()
    ? user.firstName.trim().charAt(0).toUpperCase()
    : 'U'

  // Dynamic Live Timer state (counts up from 0)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isRecording, setIsRecording] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Audio / Microphone hardware references
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [audioVolume, setAudioVolume] = useState(0)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)

  // Start Microphone Hardware
  const startMicrophone = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone is not supported by your browser')
      }

      // Stop any existing tracks before acquiring fresh stream
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        } catch (_) {}
        mediaStreamRef.current = null
      }

      let audioStream
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
      } catch (advancedErr) {
        console.warn('Advanced audio constraints failed or unsupported, falling back to basic audio: true', advancedErr)
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }

      mediaStreamRef.current = audioStream
      setIsAudioOn(true)

      // Audio volume meter
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new AudioCtx()
          }
          const audioCtx = audioContextRef.current
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {})
          }
          const source = audioCtx.createMediaStreamSource(audioStream)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 64
          source.connect(analyser)
          analyserRef.current = analyser

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          const checkVolume = () => {
            if (!analyserRef.current) return
            analyser.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]
            }
            setAudioVolume(sum / dataArray.length)
            animFrameRef.current = requestAnimationFrame(checkVolume)
          }
          checkVolume()
        }
      } catch (e) {
        console.warn('Audio analyzer setup note:', e)
      }
      return audioStream
    } catch (err) {
      console.warn('Failed to start microphone hardware:', err)
      setIsAudioOn(false)
      throw err
    }
  }

  // Stop Microphone Hardware
  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.stop()
        })
      } catch (_) {}
      mediaStreamRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    setAudioVolume(0)
    setIsAudioOn(false)
  }

  const handleToggleAudio = () => {
    if (interviewModeRef.current === 'voice') {
      handleToggleMute()
    } else {
      if (isAudioOn) {
        stopMicrophone()
      } else {
        startMicrophone().catch((err) => {
          console.warn('Manual audio toggle error:', err)
        })
      }
    }
  }


  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        } catch (_) {}
      }
    }
  }, [])

  /* =========================================================================
     VOICE INTERVIEW ARCHITECTURE & STATE MACHINE
     ========================================================================= */
  const VOICE_STATES = {
    INITIALIZING: 'INITIALIZING',
    INTERVIEWER_SPEAKING: 'INTERVIEWER_SPEAKING',
    WAITING_FOR_CANDIDATE: 'WAITING_FOR_CANDIDATE',
    CANDIDATE_SPEAKING: 'CANDIDATE_SPEAKING',
    TRANSCRIBING: 'TRANSCRIBING',
    AI_PROCESSING: 'AI_PROCESSING',
    INTERVIEW_COMPLETE: 'INTERVIEW_COMPLETE',
    ERROR: 'ERROR',
  }

  // Interview Mode: 'voice' | 'text'
  const [interviewMode, setInterviewMode] = useState('voice')
  const interviewModeRef = useRef('voice')
  useEffect(() => {
    interviewModeRef.current = interviewMode
  }, [interviewMode])

  const [voiceState, setVoiceState] = useState(VOICE_STATES.INITIALIZING)
  const [voiceError, setVoiceError] = useState(null)
  const [lastTranscript, setLastTranscript] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [playingMessageId, setPlayingMessageId] = useState(null)

  // Voice Mute & Silence Auto-Send state
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const isVoiceMutedRef = useRef(false)
  useEffect(() => {
    isVoiceMutedRef.current = isVoiceMuted
  }, [isVoiceMuted])

  const silenceTimerRef = useRef(null)
  const [silenceCountdown, setSilenceCountdown] = useState(0)
  const silenceCountdownIntervalRef = useRef(null)

  // Interview Mode Selection Modal state
  const [isModeModalOpen, setIsModeModalOpen] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const liveTranscriptRef = useRef('')
  const recognitionRef = useRef(null)
  const voiceStateRef = useRef(VOICE_STATES.INITIALIZING)

  useEffect(() => {
    voiceStateRef.current = voiceState
  }, [voiceState])

  const updateLiveTranscript = (text) => {
    liveTranscriptRef.current = text
    setLiveTranscript(text)
  }

  // MediaRecorder references
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const currentAudioPlayerRef = useRef(null)
  const currentUtteranceRef = useRef(null)
  const audioCacheRef = useRef(new Map())

  // Stop any active TTS audio playback
  const stopCurrentAudio = () => {
    if (currentAudioPlayerRef.current) {
      try {
        currentAudioPlayerRef.current.pause()
        currentAudioPlayerRef.current.currentTime = 0
      } catch (_) {}
      currentAudioPlayerRef.current = null
    }
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch (_) {}
    }
    setPlayingMessageId(null)
  }

  // Transition from AI Speech to Candidate Listening
  const handleAiSpeakingFinished = () => {
    setPlayingMessageId(null)
    currentAudioPlayerRef.current = null
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current = null
    }

    voiceStateRef.current = VOICE_STATES.WAITING_FOR_CANDIDATE
    setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)

    if (!isVoiceMutedRef.current && interviewModeRef.current === 'voice' && !isCompleted) {
      startVoiceListening()
    }
  }

  // Play Interviewer TTS Audio with strict Turn-Taking protection
  const playInterviewerAudio = (audioUrl, messageId = null, fallbackText = null) => {
    if (!audioUrl) {
      if (fallbackText && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          stopCurrentAudio()
          const utterance = new SpeechSynthesisUtterance(fallbackText)
          currentUtteranceRef.current = utterance
          utterance.rate = 1.0
          setVoiceState(VOICE_STATES.INTERVIEWER_SPEAKING)
          setPlayingMessageId(messageId)
          utterance.onend = () => {
            currentUtteranceRef.current = null
            handleAiSpeakingFinished()
          }
          utterance.onerror = () => {
            currentUtteranceRef.current = null
            handleAiSpeakingFinished()
          }
          window.speechSynthesis.speak(utterance)
          return
        } catch (_) {
          currentUtteranceRef.current = null
        }
      }
      handleAiSpeakingFinished()
      return
    }

    stopCurrentAudio()

    try {
      const audio = new Audio(audioUrl)
      currentAudioPlayerRef.current = audio
      setPlayingMessageId(messageId)
      // Turn-taking rule: Disable candidate microphone while interviewer is speaking
      setVoiceState(VOICE_STATES.INTERVIEWER_SPEAKING)
      setVoiceError(null)

      audio.onended = () => handleAiSpeakingFinished()

      audio.onerror = (e) => {
        console.warn('[VoiceMode] Audio playback error:', e)
        if (fallbackText && 'speechSynthesis' in window) {
          try {
            const utterance = new SpeechSynthesisUtterance(fallbackText)
            currentUtteranceRef.current = utterance
            utterance.onend = () => {
              currentUtteranceRef.current = null
              handleAiSpeakingFinished()
            }
            utterance.onerror = () => {
              currentUtteranceRef.current = null
              handleAiSpeakingFinished()
            }
            window.speechSynthesis.speak(utterance)
            return
          } catch (_) {
            currentUtteranceRef.current = null
          }
        }
        handleAiSpeakingFinished()
      }

      audio.play().catch((err) => {
        console.warn('[VoiceMode] Audio autoplay was prevented or delayed:', err)
        if (fallbackText && 'speechSynthesis' in window) {
          try {
            const utterance = new SpeechSynthesisUtterance(fallbackText)
            currentUtteranceRef.current = utterance
            utterance.onend = () => {
              currentUtteranceRef.current = null
              handleAiSpeakingFinished()
            }
            utterance.onerror = () => {
              currentUtteranceRef.current = null
              handleAiSpeakingFinished()
            }
            window.speechSynthesis.speak(utterance)
            return
          } catch (_) {
            currentUtteranceRef.current = null
          }
        }
        handleAiSpeakingFinished()
      })
    } catch (err) {
      console.warn('[VoiceMode] playInterviewerAudio exception:', err)
      handleAiSpeakingFinished()
    }
  }

  // Synthesize and play speech on-demand for any AI message
  const handleSynthesizeSpeech = async (text, messageId) => {
    if (!text) return
    setVoiceState(VOICE_STATES.INTERVIEWER_SPEAKING)
    setPlayingMessageId(messageId)

    if (audioCacheRef.current.has(messageId)) {
      playInterviewerAudio(audioCacheRef.current.get(messageId), messageId, text)
      return
    }

    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)

      const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/voice/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        if (data.audioUrl) {
          audioCacheRef.current.set(messageId, data.audioUrl)
          playInterviewerAudio(data.audioUrl, messageId, text)
        } else {
          playInterviewerAudio(null, messageId, text)
        }
      } else {
        playInterviewerAudio(null, messageId, text)
      }
    } catch (err) {
      console.warn('[VoiceMode] TTS synthesis notice, using native speech:', err)
      playInterviewerAudio(null, messageId, text)
    }
  }

  // Live Interview State from authoritative backend
  const [interviewState, setInterviewState] = useState(null)
  const [isCompleted, setIsCompleted] = useState(false)
  const [transcriptMessages, setTranscriptMessages] = useState([])
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activeMobileTab, setActiveMobileTab] = useState('center')
  const transcriptEndRef = useRef(null)
  const hasInitializedRef = useRef(false)

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Handler when user selects mode from the Welcome Modal
  const handleSelectMode = async (selectedMode) => {
    setIsModeModalOpen(false)
    setInterviewMode(selectedMode)
    sessionStorage.setItem(`hiremind_mode_${interviewId}`, selectedMode)

    if (selectedMode === 'voice') {
      // User gesture: unlock AudioContext immediately so autoplay succeeds
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          if (ctx.state === 'suspended') ctx.resume()
        }
      } catch (_) {}

      // Prompt and initialize microphone
      try {
        await startMicrophone()
      } catch (_) {}

      // Directly start asking questions and automatically read aloud
      await startOrResumeInterview('voice', true)
    } else {
      await startOrResumeInterview('text', false)
    }
  }

  const startOrResumeInterview = async (mode = 'voice', shouldAutoPlayAudio = true) => {
    try {
      setVoiceState(VOICE_STATES.INITIALIZING)
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/begin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ mode, includeAudio: mode === 'voice' }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.interviewState) {
          setInterviewState(data.interviewState)
          if (data.interviewState.status === 'completed' || data.interviewState.status === 'ended_by_user') {
            setIsCompleted(true)
            setVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
            return
          }
        }

        if (data.chatMessages && data.chatMessages.length > 0) {
          const mapped = data.chatMessages.map((m, idx) => ({
            id: m._id || `msg-${idx}-${Date.now()}`,
            sender: m.role === 'candidate' ? 'candidate' : 'ai',
            senderName: m.role === 'candidate' ? (user?.firstName || 'You') : 'HireMind AI Interviewer',
            time: new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            stage: m.metrics?.stageName || data.stage || null,
            text: m.content,
          }))
          setTranscriptMessages(mapped)
          const lastMsg = mapped[mapped.length - 1]
          if (lastMsg && lastMsg.sender === 'ai' && shouldAutoPlayAudio) {
            if (lastMsg.audioUrl) {
              playInterviewerAudio(lastMsg.audioUrl, lastMsg.id, lastMsg.text)
            } else {
              handleSynthesizeSpeech(lastMsg.text, lastMsg.id)
            }
          } else {
            setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
          }
        } else if (data.question) {
          const openMsgId = `ai-open-${Date.now()}`
          setTranscriptMessages([
            {
              id: openMsgId,
              sender: 'ai',
              senderName: 'HireMind AI Interviewer',
              time: '00:00',
              stage: data.stage || 'Introduction',
              text: data.question,
            },
          ])

          // AUTOMATICALLY READ OPENING QUESTION ALOUD IMMEDIATELY
          if (data.audioUrl) {
            audioCacheRef.current.set(openMsgId, data.audioUrl)
            playInterviewerAudio(data.audioUrl, openMsgId, data.question)
          } else {
            handleSynthesizeSpeech(data.question, openMsgId)
          }
        } else {
          setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
        }
      } else {
        setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      }
    } catch (err) {
      console.warn('[InterviewRoom] Live interview initialization notice:', err)
      setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
    }
  }

  // Session check on load: if brand new interview, ask user whether they want Voice or Text
  useEffect(() => {
    if (!interviewId || interviewId === 'default' || hasInitializedRef.current) return
    hasInitializedRef.current = true

    const checkInitialSession = async () => {
      try {
        const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
        const res = await fetch(`http://localhost:5000/api/interview/${interviewId}`, {
          headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        })

        if (res.ok) {
          const data = await res.json()
          const sess = data.session || data
          if (sess) {
            if (sess.interviewState?.status === 'completed' || sess.interviewState?.status === 'ended_by_user') {
              setIsCompleted(true)
              setVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
              if (sess.chatMessages) {
                const mapped = sess.chatMessages.map((m, idx) => ({
                  id: m._id || `msg-${idx}-${Date.now()}`,
                  sender: m.role === 'candidate' ? 'candidate' : 'ai',
                  senderName: m.role === 'candidate' ? (user?.firstName || 'You') : 'HireMind AI Interviewer',
                  time: new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  stage: m.metrics?.stageName || null,
                  text: m.content,
                }))
                setTranscriptMessages(mapped)
              }
              return
            }

            const candidateMsgs = (sess.chatMessages || []).filter((m) => m.role === 'candidate')
            const savedMode = sessionStorage.getItem(`hiremind_mode_${interviewId}`)

            if (candidateMsgs.length > 0 || savedMode) {
              // Resuming ongoing session with previous candidate interaction
              const modeToUse = savedMode || 'voice'
              setInterviewMode(modeToUse)
              startOrResumeInterview(modeToUse, false)
              return
            }
          }
        }
      } catch (err) {
        console.warn('[InterviewRoom] Initial check error:', err)
      }

      // Fresh interview: prompt user with Voice vs Text Modal
      setIsModeModalOpen(true)
    }

    checkInitialSession()
  }, [interviewId, user?.firstName])

  // Auto-scroll chat on new message
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcriptMessages, isAiTyping])

  // Get the most recent AI question for the Voice Cockpit
  const latestAiQuestion = transcriptMessages
    .slice()
    .reverse()
    .find((m) => m.sender === 'ai')

  /* =========================================================================
     CANDIDATE ANSWER SUBMISSION PIPELINE (Shared between Voice & Text)
     ========================================================================= */
  const submitCandidateAnswer = async (answerText, inputMode = 'text', durationSeconds = 0, sttLatencyMs = null) => {
    const trimmed = (answerText || '').trim()
    if (!trimmed || isAiTyping || isCompleted) return

    stopCurrentAudio()

    const candidateMsg = {
      id: `cand-${Date.now()}`,
      sender: 'candidate',
      senderName: user?.firstName || 'You',
      time: formatTimer(secondsElapsed),
      text: trimmed,
      inputMode,
    }

    setTranscriptMessages((prev) => [...prev, candidateMsg])
    setInputValue('')
    setIsAiTyping(true)
    setVoiceState(VOICE_STATES.AI_PROCESSING)
    setVoiceError(null)

    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          answer: trimmed,
          inputMode,
          mode: interviewMode,
          includeAudio: interviewMode === 'voice',
          durationSeconds,
          sttLatencyMs,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.interviewState) {
          setInterviewState(data.interviewState)
        }

        if (data.nextQuestion) {
          const aiMsgId = `ai-${Date.now()}`
          const aiMsg = {
            id: aiMsgId,
            sender: 'ai',
            senderName: 'HireMind AI Interviewer',
            time: formatTimer(secondsElapsed + 2),
            stage: data.stage || interviewState?.currentStageName || null,
            text: data.nextQuestion,
          }
          setTranscriptMessages((prev) => [...prev, aiMsg])
          setIsAiTyping(false)

          if (data.isComplete) {
            setIsCompleted(true)
          }

          // ALWAYS AUTOMATICALLY READ QUESTION ALOUD AS SOON AS GENERATED
          if (data.audioUrl) {
            audioCacheRef.current.set(aiMsgId, data.audioUrl)
            playInterviewerAudio(data.audioUrl, aiMsgId, data.nextQuestion)
          } else {
            handleSynthesizeSpeech(data.nextQuestion, aiMsgId)
          }
          return
        }

        if (data.isComplete) {
          setIsCompleted(true)
          setVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
          setIsAiTyping(false)
          return
        }
      } else if (res.status === 409) {
        console.warn('[InterviewRoom] Duplicate turn detected, ignoring.')
        setIsAiTyping(false)
        setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
        return
      } else {
        throw new Error(`Server returned status ${res.status}`)
      }
    } catch (err) {
      console.warn('[InterviewRoom] Answer processing error:', err)
      setVoiceError({
        code: 'INTERVIEW_AGENT_FAILED',
        message: 'Could not connect to the interview engine. Your answer has been saved; please retry.',
        canRetry: true,
        canSwitchToText: true,
      })
      setVoiceState(VOICE_STATES.ERROR)
      setIsAiTyping(false)
    }
  }

  // Handle Text Submission Form
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault()
    if (!inputValue.trim() || isAiTyping || isCompleted) return
    submitCandidateAnswer(inputValue, 'text')
  }

  /* =========================================================================
     VOICE ACTIVITY DETECTION (VAD), 3s SILENCE AUTO-SEND, & MUTE CONTROLS
     ========================================================================= */
  const resetSilenceDetection = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (silenceCountdownIntervalRef.current) {
      clearInterval(silenceCountdownIntervalRef.current)
      silenceCountdownIntervalRef.current = null
    }
    setSilenceCountdown(0)
  }

  const startSilenceDetection = () => {
    resetSilenceDetection()
    if (isVoiceMutedRef.current) return

    let secondsRemaining = 3
    setSilenceCountdown(secondsRemaining)

    silenceCountdownIntervalRef.current = setInterval(() => {
      secondsRemaining -= 1
      if (secondsRemaining > 0) {
        setSilenceCountdown(secondsRemaining)
      } else {
        if (silenceCountdownIntervalRef.current) {
          clearInterval(silenceCountdownIntervalRef.current)
          silenceCountdownIntervalRef.current = null
        }
        setSilenceCountdown(0)
      }
    }, 1000)

    silenceTimerRef.current = setTimeout(() => {
      resetSilenceDetection()
      const textToSend = (liveTranscriptRef.current || '').trim()
      if (textToSend && !isVoiceMutedRef.current) {
        console.log('[VoiceMode] 3s silence reached, auto-submitting answer:', textToSend)
        handleCommitCandidateSpeech(textToSend)
      }
    }, 3000)
  }

  // Finalize speech and commit to transcript / backend
  const handleCommitCandidateSpeech = (explicitText = null) => {
    resetSilenceDetection()

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (_) {}
      recognitionRef.current = null
    }

    const candidateText = (explicitText !== null ? explicitText : (liveTranscriptRef.current || '')).trim()

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    } else if (candidateText) {
      finalizeCandidateSpeech(candidateText)
    } else {
      finalizeCandidateSpeech('')
    }
  }

  // Start continuous listening when candidate's turn begins
  const startVoiceListening = async () => {
    if (
      isVoiceMutedRef.current ||
      voiceStateRef.current === VOICE_STATES.AI_PROCESSING ||
      voiceStateRef.current === VOICE_STATES.TRANSCRIBING ||
      isAiTyping ||
      isCompleted
    ) {
      return
    }

    stopCurrentAudio()
    setVoiceError(null)
    updateLiveTranscript('')
    resetSilenceDetection()
    setIsAudioOn(true)
    voiceStateRef.current = VOICE_STATES.CANDIDATE_SPEAKING
    setVoiceState(VOICE_STATES.CANDIDATE_SPEAKING)

    try {
      let stream = mediaStreamRef.current
      const hasLiveTrack = stream && stream.getAudioTracks().some((t) => t.readyState === 'live')
      if (!hasLiveTrack) {
        stream = await startMicrophone()
      } else {
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true
        })
        setIsAudioOn(true)
      }

      // 1. Initialize Web Speech API for real-time live typing directly into the UI
      const SpeechRecognition = typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null

      if (SpeechRecognition) {
        try {
          if (recognitionRef.current) {
            try { recognitionRef.current.stop() } catch (_) {}
          }

          const recognition = new SpeechRecognition()
          recognition.continuous = true
          recognition.interimResults = true
          recognition.lang = 'en-US'

          recognition.onresult = (event) => {
            if (isVoiceMutedRef.current) return

            let final = ''
            let interim = ''
            for (let i = 0; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript + ' '
              } else {
                interim += event.results[i][0].transcript
              }
            }
            const combined = (final + interim).trim()
            if (combined) {
              updateLiveTranscript(combined)
              // Reset and restart 3-second silence auto-send timer
              startSilenceDetection()
            }
          }

          recognition.onerror = (e) => {
            console.warn('[WebSpeech] Recognition notice:', e.error)
          }

          recognition.onend = () => {
            // Auto-restart if candidate is still speaking/unmuted
            if (
              !isVoiceMutedRef.current &&
              voiceStateRef.current === VOICE_STATES.CANDIDATE_SPEAKING &&
              recognitionRef.current
            ) {
              try {
                recognitionRef.current.start()
              } catch (_) {}
            }
          }

          try {
            recognition.start()
          } catch (recStartErr) {
            console.warn('[WebSpeech] SpeechRecognition start warning, retrying:', recStartErr)
            setTimeout(() => {
              if (!isVoiceMutedRef.current && voiceStateRef.current === VOICE_STATES.CANDIDATE_SPEAKING) {
                try { recognition.start() } catch (_) {}
              }
            }, 150)
          }
          recognitionRef.current = recognition
        } catch (recErr) {
          console.warn('[WebSpeech] SpeechRecognition start notice:', recErr)
        }
      }

      // 2. Initialize MediaRecorder as reliable audio capture fallback
      try {
        if (typeof MediaRecorder !== 'undefined' && stream) {
          let mimeType = 'audio/webm;codecs=opus'
          if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm'
            else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'
            else mimeType = ''
          }

          recordedChunksRef.current = []
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
          mediaRecorderRef.current = recorder

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordedChunksRef.current.push(event.data)
            }
          }

          recorder.onstop = () => {
            const audioBlob = new Blob(recordedChunksRef.current, { type: mimeType || 'audio/webm' })
            handleRecordedAudioStop(audioBlob)
          }

          recorder.start(250)
        }
      } catch (recorderErr) {
        console.warn('[VoiceMode] MediaRecorder fallback init note:', recorderErr)
      }

      setVoiceState(VOICE_STATES.CANDIDATE_SPEAKING)
      setRecordingSeconds(0)

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('[VoiceMode] Failed to start microphone:', err)
      setVoiceState(VOICE_STATES.ERROR)

      let errorMessage = 'Microphone permission was denied or microphone hardware is unavailable.'
      let errorDetails = ''

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission is blocked in your browser.'
        errorDetails = 'Click the lock or tune icon 🔒 in your browser address bar (next to the URL), change Microphone to "Allow", and then click "Try Turning ON Mic Again".'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No microphone device was detected on your computer.'
        errorDetails = 'Please ensure your microphone or headset is connected and enabled in your sound settings, then click "Try Turning ON Mic Again".'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Microphone is currently in use by another application.'
        errorDetails = 'Please close any other application using your microphone (e.g. Teams, Zoom, Discord) and click "Try Turning ON Mic Again".'
      } else if (err.message) {
        errorMessage = `Microphone error: ${err.message}`
        errorDetails = 'Please ensure your microphone is enabled and accessible to your browser.'
      }

      setVoiceError({
        code: 'MICROPHONE_PERMISSION_DENIED',
        message: errorMessage,
        details: errorDetails,
        canRetry: true,
        canSwitchToText: true,
      })
    }
  }

  // Toggle Mute / Unmute
  const handleToggleMute = () => {
    if (isVoiceMuted) {
      setIsVoiceMuted(false)
      isVoiceMutedRef.current = false
      setIsAudioOn(true)

      // Stop interviewer audio immediately so candidate can speak without overlap
      stopCurrentAudio()
      voiceStateRef.current = VOICE_STATES.WAITING_FOR_CANDIDATE
      setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)

      if (!mediaStreamRef.current || !mediaStreamRef.current.getAudioTracks().some((t) => t.readyState === 'live')) {
        startMicrophone()
          .then(() => {
            if (interviewModeRef.current === 'voice' && !isCompleted) {
              startVoiceListening()
            }
          })
          .catch((err) => {
            console.warn('Microphone start on unmute notice:', err)
          })
      } else {
        try {
          mediaStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = true
          })
        } catch (_) {}
        if (
          voiceStateRef.current !== VOICE_STATES.AI_PROCESSING &&
          voiceStateRef.current !== VOICE_STATES.TRANSCRIBING &&
          !isAiTyping &&
          !isCompleted
        ) {
          startVoiceListening()
        }
      }
    } else {
      setIsVoiceMuted(true)
      isVoiceMutedRef.current = true
      resetSilenceDetection()
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = false
          })
        } catch (_) {}
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (_) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch (_) {}
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      voiceStateRef.current = VOICE_STATES.WAITING_FOR_CANDIDATE
      setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
    }
  }

  // Backwards-compatible toggle bridge
  const handleToggleVoiceMic = (turnOn) => {
    if (turnOn) {
      if (isVoiceMuted) {
        setIsVoiceMuted(false)
        isVoiceMutedRef.current = false
      }
      startVoiceListening()
    } else {
      handleCommitCandidateSpeech()
    }
  }

  // Handle MediaRecorder completion
  const handleRecordedAudioStop = async (audioBlob) => {
    const candidateText = (liveTranscriptRef.current || '').trim()
    if (candidateText) {
      finalizeCandidateSpeech(candidateText)
      return
    }

    // Fallback: If Web Speech API captured no text, transcribe audio with Whisper
    setVoiceState(VOICE_STATES.TRANSCRIBING)
    handleProcessRecordedAudio(audioBlob)
  }

  // Finalize authentic candidate speech and dispatch to AI Interview Agent
  const finalizeCandidateSpeech = (text) => {
    const trimmed = (text || '').trim()
    if (!trimmed) {
      setVoiceState(VOICE_STATES.ERROR)
      setVoiceError({
        code: 'EMPTY_SPEECH',
        message: "We couldn't hear any speech. Please turn on your microphone and try speaking again.",
        canRetry: true,
        canSwitchToText: true,
      })
      return
    }

    setLastTranscript(trimmed)
    updateLiveTranscript('')
    submitCandidateAnswer(trimmed, 'voice', recordingSeconds)
  }

  // Fallback: Process Recorded Audio Blob via Whisper STT
  const handleProcessRecordedAudio = async (audioBlob) => {
    if (!audioBlob || audioBlob.size < 1000) {
      setVoiceState(VOICE_STATES.ERROR)
      setVoiceError({
        code: 'EMPTY_AUDIO',
        message: "We couldn't clearly capture that answer. Recording was empty or too brief. Please try again.",
        canRetry: true,
        canSwitchToText: true,
      })
      return
    }

    const durationSnapshot = recordingSeconds || 1

    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const formData = new FormData()
      formData.append('audio', audioBlob, 'candidate_answer.webm')
      formData.append('duration', durationSnapshot)

      const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/voice/transcribe`, {
        method: 'POST',
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `Transcription failed with status ${res.status}`)
      }

      const data = await res.json()
      const transcript = (data.text || '').trim()

      if (!transcript || data.success === false) {
        setVoiceState(VOICE_STATES.ERROR)
        setVoiceError({
          code: 'EMPTY_TRANSCRIPT',
          message: "We couldn't clearly capture that answer. Please try turning on your microphone and answering again.",
          canRetry: true,
          canSwitchToText: true,
        })
        return
      }

      setLastTranscript(transcript)
      submitCandidateAnswer(transcript, 'voice', durationSnapshot, data.latencyMs)
    } catch (err) {
      console.warn('[VoiceMode] STT processing error:', err)
      setVoiceState(VOICE_STATES.ERROR)
      setVoiceError({
        code: 'STT_FAILED',
        message: 'Speech recognition was unable to transcribe your response. Please try recording again or switch to text mode.',
        canRetry: true,
        canSwitchToText: true,
      })
    }
  }

  // End Interview manually with backend tracking
  const handleEndCall = async () => {
    const confirmEnd = window.confirm(
      'Are you sure you want to conclude this interview session? Your progress and transcript will be safely preserved.'
    )
    if (confirmEnd) {
      stopCurrentAudio()
      try {
        const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
        await fetch(`http://localhost:5000/api/interview/${interviewId}/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
        })
      } catch (e) {
        console.warn('Manual end call network notice:', e)
      }

      if (interviewId && interviewId !== 'default') {
        saveInterviewSession({
          id: interviewId,
          status: 'completed',
          lastVisitedPath: `/interview-report?id=${interviewId}`,
        })
      }
      navigate(`/interview-report?id=${interviewId}`)
    }
  }

  // Derive dynamic session information
  const candidateTurns = transcriptMessages.filter((m) => m.sender === 'candidate').length
  const stages = session?.userFacingPlan?.stages || session?.interviewPlan?.stages || []
  const currentStageIndex = Math.min(candidateTurns, Math.max(0, stages.length - 1))
  const currentStage = stages[currentStageIndex] || null
  const currentStageNumber = currentStageIndex + 1
  const totalStages = stages.length || 4

  const displayRole = session?.targetRole || session?.resumeAnalysis?.detected_role || 'Software Engineer Intern'
  const displayCompany = session?.company || 'Target Company'
  const displayResume = session?.resumeFileName || session?.uploadedResume || 'Uploaded_Resume.pdf'
  const displayJd = session?.jobDescription || 'Looking for an engineer with strong computer science fundamentals, system design proficiency, and agile development experience.'

  return (
    <div className="int-room-page">
      {/* Background Ambience */}
      <div className="int-room-bg" aria-hidden="true" />
      <div className="int-room-glow-top" aria-hidden="true" />
      <div className="int-room-glow-bottom" aria-hidden="true" />

      {/* =====================================================================
          TOP NAVIGATION BAR
          ===================================================================== */}
      <header className="int-room-nav">
        <div className="int-room-nav__left">
          <button
            type="button"
            className="int-room-nav__menu-btn"
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
            aria-label="Navigation Menu"
          >
            <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1.5H19M1 7.5H19M1 13.5H19" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="int-room-nav__title-group">
            <h1 className="int-room-nav__title">{displayRole}</h1>
            <span className="int-room-nav__company-pill">{displayCompany}</span>
          </div>
        </div>

        <div className="int-room-nav__right">
          {/* Chatbot Toggle Button */}
          <button
            type="button"
            className={`int-room-nav__icon-btn ${isChatOpen ? 'is-active' : ''}`}
            onClick={() => setIsChatOpen((prev) => !prev)}
            title="AI Coach Assistant"
            aria-label="Toggle AI Coach"
          >
            <img src={chatbotIcon} alt="Chatbot" className="int-room-nav__bot-icon" />
          </button>

          {/* Share Button */}
          <button
            type="button"
            className="int-room-nav__share-btn"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href)
                alert('Session link copied to clipboard!')
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

      {/* Mobile Tab Switcher */}
      <div className="int-room-mobile-tabs">
        <button
          type="button"
          className={`int-room-mobile-tab ${activeMobileTab === 'context' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('context')}
        >
          Session Context & Plan
        </button>
        <button
          type="button"
          className={`int-room-mobile-tab ${activeMobileTab === 'center' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('center')}
        >
          AI Interview Chat
        </button>
      </div>

      {/* =====================================================================
          MAIN COCKPIT WORKSPACE (2 Columns: Left Context + Center AI Chat Stage)
          ===================================================================== */}
      <div className="int-room-workspace">
        {/* ===================================================================
            COLUMN 1: Left Context & Question Progress Card
            =================================================================== */}
        <section
          className={`int-room-col int-room-col--left ${
            activeMobileTab === 'context' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          {/* Top-Left Session Timer & End Call Action */}
          <div className="int-room-ctrl-row">
            <div className={`int-room-rec-pill ${isRecording ? 'is-recording' : ''}`}>
              <span className="int-room-rec-dot-wrap">
                <img src={recordingDotIcon} alt="REC" className="int-room-rec-dot" />
              </span>
              <span className="int-room-rec-label">REC</span>
              <span className="int-room-rec-time">{formatTimer(secondsElapsed)}</span>
            </div>

            {/* Circular Red End-Call Button */}
            <button
              type="button"
              className="int-room-end-call-btn"
              onClick={handleEndCall}
              title="End Interview"
              aria-label="End Interview"
            >
              <img src={callHangupIcon} alt="End Call" className="int-room-end-call-icon" />
            </button>
          </div>

          {/* Context Card */}
          <div className="int-room-card">
            {/* Dynamic Stage Header */}
            <div className="int-room-q-header">
              <span className="int-room-q-line" />
              <span className="int-room-q-title">
                STAGE {currentStageNumber} OF {totalStages}
              </span>
              <span className="int-room-q-line" />
            </div>

            {/* Dynamic Item 1: Resume */}
            <div className="int-room-info-item">
              <div className="int-room-info-icon-wrap is-green">
                <img src={tick2Icon} alt="" className="int-room-check-icon" />
              </div>
              <span className="int-room-info-text" title={displayResume}>
                {displayResume}
              </span>
            </div>

            {/* Dynamic Item 2: Role */}
            <div className="int-room-info-item">
              <div className="int-room-info-icon-wrap is-slate">
                <svg width="16" height="15" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 5H14V3C14 1.89543 13.1046 1 12 1H8C6.89543 1 6 1.89543 6 3V5H2C0.89543 5 0 5.89543 0 7V15C0 16.1046 0.89543 17 2 17H18C19.1046 17 20 16.1046 20 15V7C20 5.89543 19.1046 5 18 5ZM8 3H12V5H8V3ZM18 15H2V7H18V15Z"
                    fill="#94A3B8"
                  />
                </svg>
              </div>
              <span className="int-room-info-text" title={displayRole}>
                {displayRole}
              </span>
            </div>

            {/* Dynamic Item 3: Company */}
            <div className="int-room-info-item">
              <div className="int-room-info-icon-wrap is-slate">
                <img src={company1Icon} alt="" className="int-room-building-icon" />
              </div>
              <span className="int-room-info-text" title={displayCompany}>
                {displayCompany}
              </span>
            </div>

            {/* Dynamic Configuration Tags */}
            <div className="int-room-config-tags">
              <span className="int-room-config-tag is-cyan">{session?.interviewType || 'Role-Specific'}</span>
              <span className="int-room-config-tag is-indigo">{session?.difficulty || 'Intermediate'}</span>
              <span className="int-room-config-tag is-emerald">{session?.duration || '30 min'}</span>
            </div>

            {/* Inset Job Description Box */}
            <div className="int-room-jd-group">
              <div className="int-room-jd-header">
                <span className="int-room-jd-label">JOB DESCRIPTION</span>
              </div>
              <div className="int-room-jd-box">
                <p>{displayJd}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 2: Center Stage AI Interview Communication Area
            (Voice Cockpit Deck + Chat Stream)
            =================================================================== */}
        <section
          className={`int-room-col int-room-col--center ${
            activeMobileTab === 'center' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          <div className="int-room-chat-stage">
            {/* Stage Header */}
            <div className="int-room-stage-header">
              <div className="int-room-stage-bot-info">
                <div className="int-room-stage-bot-avatar">
                  <img src={chatbotIcon} alt="AI" className="int-room-stage-bot-icon" />
                  <span className="int-room-stage-bot-dot" />
                </div>
                <div className="int-room-stage-bot-text">
                  <div className="int-room-stage-bot-name">HireMind AI Interviewer</div>
                  <div className="int-room-stage-bot-sub">
                    <span className="int-room-stage-live-dot" /> Live Session • Question {candidateTurns + 1}
                  </div>
                </div>
              </div>

              <div className="int-room-stage-actions">
                {/* Active Stage Indicator */}
                {currentStage && (
                  <div className="int-room-stage-pill">
                    <span className="int-room-stage-pill-num">Stage {currentStageNumber}</span>
                    <span className="int-room-stage-pill-title">{currentStage.name || currentStage.title}</span>
                  </div>
                )}

                {/* Floating Microphone Action Button */}
                <button
                  type="button"
                  className={`int-room-mic-status-pill ${isAudioOn && !isVoiceMuted ? 'is-active' : 'is-muted'}`}
                  onClick={handleToggleAudio}
                  title={isAudioOn && !isVoiceMuted ? 'Mute microphone' : 'Unmute microphone'}
                  aria-label="Toggle Microphone"
                >
                  <img src={audioIcon} alt="Mic" className="int-room-mic-status-icon" />
                  <span>{isAudioOn && !isVoiceMuted ? 'Mic Active' : 'Muted'}</span>
                  {isAudioOn && !isVoiceMuted && audioVolume > 5 && <span className="int-room-mic-wave-pulse" />}
                </button>
              </div>
            </div>

            {/* ===============================================================
                VOICE STATUS STRIP (Active during Voice Interview Mode)
                =============================================================== */}
            {interviewMode === 'voice' && !isCompleted && (
              <div className="int-room-voice-deck">
                <div className="int-room-voice-status-bar">
                  {voiceState === VOICE_STATES.INTERVIEWER_SPEAKING && (
                    <span className="int-room-voice-badge is-speaking">
                      <span className="int-room-pulse-dot is-cyan" />
                      🔊 AI Interviewer Speaking... (Please Listen)
                    </span>
                  )}
                  {voiceState === VOICE_STATES.WAITING_FOR_CANDIDATE && (
                    <span className="int-room-voice-badge is-waiting">
                      <span className="int-room-pulse-dot is-green" />
                      🎤 Ready for your answer (Turn ON mic below)
                    </span>
                  )}
                  {voiceState === VOICE_STATES.CANDIDATE_SPEAKING && (
                    <span className="int-room-voice-badge is-recording">
                      <span className="int-room-pulse-dot is-red" />
                      🔴 Microphone ON • Speech typing live...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.TRANSCRIBING && (
                    <span className="int-room-voice-badge is-transcribing">
                      <span className="int-room-pulse-dot is-purple" />
                      ⚡ Finalizing speech transcription...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.AI_PROCESSING && (
                    <span className="int-room-voice-badge is-thinking">
                      <span className="int-room-pulse-dot is-yellow" />
                      🧠 HireMind AI thinking...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.ERROR && (
                    <span className="int-room-voice-badge is-error">
                      <span className="int-room-pulse-dot is-red" />
                      ⚠️ Attention Needed
                    </span>
                  )}

                  {/* Real-time Dynamic Waveform Visualizer */}
                  <div className="int-room-wave-visualizer" aria-hidden="true">
                    <span
                      className={`int-room-wave-bar ${voiceState === VOICE_STATES.INTERVIEWER_SPEAKING || (voiceState === VOICE_STATES.CANDIDATE_SPEAKING && audioVolume > 5) ? 'is-animated' : ''}`}
                    />
                    <span
                      className={`int-room-wave-bar ${voiceState === VOICE_STATES.INTERVIEWER_SPEAKING || (voiceState === VOICE_STATES.CANDIDATE_SPEAKING && audioVolume > 8) ? 'is-animated' : ''}`}
                    />
                    <span
                      className={`int-room-wave-bar ${voiceState === VOICE_STATES.INTERVIEWER_SPEAKING || (voiceState === VOICE_STATES.CANDIDATE_SPEAKING && audioVolume > 12) ? 'is-animated' : ''}`}
                    />
                    <span
                      className={`int-room-wave-bar ${voiceState === VOICE_STATES.INTERVIEWER_SPEAKING || (voiceState === VOICE_STATES.CANDIDATE_SPEAKING && audioVolume > 8) ? 'is-animated' : ''}`}
                    />
                    <span
                      className={`int-room-wave-bar ${voiceState === VOICE_STATES.INTERVIEWER_SPEAKING || (voiceState === VOICE_STATES.CANDIDATE_SPEAKING && audioVolume > 5) ? 'is-animated' : ''}`}
                    />
                  </div>
                </div>

                {/* Error Box & Safe Recovery Options */}
                {voiceError && (
                  <div className="int-room-voice-error-box">
                    <div className="int-room-voice-error-msg">{voiceError.message}</div>
                    {voiceError.details && (
                      <div className="int-room-voice-error-details" style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.45 }}>
                        {voiceError.details}
                      </div>
                    )}
                    <div className="int-room-voice-error-actions">
                      {voiceError.canRetry && (
                        <button
                          type="button"
                          className="int-room-voice-error-btn"
                          onClick={() => handleToggleVoiceMic(true)}
                        >
                          🔄 Try Turning ON Mic Again
                        </button>
                      )}
                      {voiceError.canSwitchToText && (
                        <button
                          type="button"
                          className="int-room-voice-error-btn is-alt"
                          onClick={() => {
                            setVoiceError(null)
                            setInterviewMode('text')
                          }}
                        >
                          💬 Type Answer Instead
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stage Messages Scroll Area */}
            <div className="int-room-stage-messages">
              {transcriptMessages.map((msg) => (
                <div key={msg.id} className={`int-room-chat-msg ${msg.sender === 'candidate' ? 'is-candidate' : 'is-ai'}`}>
                  <div className={`int-room-chat-msg__avatar ${msg.sender === 'candidate' && user?.avatarUrl ? 'has-image' : ''}`}>
                    {msg.sender === 'candidate' ? (
                      user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={msg.senderName} className="int-room-chat-msg__avatar-img" />
                      ) : (
                        candidateInitial
                      )
                    ) : (
                      <img src={chatbotIcon} alt="AI" className="int-room-chat-msg__ai-icon" />
                    )}
                  </div>
                  <div className="int-room-chat-msg__content-wrap">
                    <div className="int-room-chat-msg__meta">
                      <span className="int-room-chat-msg__sender">{msg.senderName}</span>
                      {msg.stage && <span className="int-room-chat-msg__stage-tag">{msg.stage}</span>}
                      <span className="int-room-chat-msg__time">{msg.time}</span>
                    </div>
                    <div className="int-room-chat-msg__bubble">
                      <p className="int-room-chat-msg__text">{msg.text}</p>
                      {/* Inline Audio Replay Button for AI Questions */}
                      {msg.sender === 'ai' && (
                        <button
                          type="button"
                          className={`int-room-inline-play-btn ${playingMessageId === msg.id ? 'is-playing' : ''}`}
                          onClick={() => handleSynthesizeSpeech(msg.text, msg.id)}
                          title={playingMessageId === msg.id ? 'Playing audio...' : 'Play question audio'}
                        >
                          <span>{playingMessageId === msg.id ? '🔊 Playing...' : '▶ Listen'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Real-time candidate speech typing automatically into UI */}
              {voiceState === VOICE_STATES.CANDIDATE_SPEAKING && (
                <div className="int-room-chat-msg is-candidate is-live-typing">
                  <div className={`int-room-chat-msg__avatar ${user?.avatarUrl ? 'has-image' : ''}`}>
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="You" className="int-room-chat-msg__avatar-img" />
                    ) : (
                      candidateInitial
                    )}
                  </div>
                  <div className="int-room-chat-msg__content-wrap">
                    <div className="int-room-chat-msg__meta">
                      <span className="int-room-chat-msg__sender">{user?.firstName || 'You'}</span>
                      {silenceCountdown > 0 ? (
                        <span className="int-room-live-speaking-badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', borderColor: 'rgba(234, 179, 8, 0.3)' }}>
                          <span className="int-room-live-speaking-dot" style={{ background: '#facc15' }} /> Sending in {silenceCountdown}s...
                        </span>
                      ) : (
                        <span className="int-room-live-speaking-badge">
                          <span className="int-room-live-speaking-dot" /> Speaking...
                        </span>
                      )}
                      <span className="int-room-chat-msg__time">{formatTimer(secondsElapsed)}</span>
                    </div>
                    <div className="int-room-chat-msg__bubble is-live-speaking-bubble">
                      <p className="int-room-chat-msg__text">
                        {liveTranscript ? (
                          liveTranscript
                        ) : (
                          <span className="int-room-speaking-placeholder">
                            Listening to your voice... Speak your answer now.
                          </span>
                        )}
                        <span className="int-room-live-cursor">|</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isAiTyping && (
                <div className="int-room-chat-msg is-ai is-typing">
                  <div className="int-room-chat-msg__avatar">
                    <img src={chatbotIcon} alt="AI" className="int-room-chat-msg__ai-icon" />
                  </div>
                  <div className="int-room-chat-msg__content-wrap">
                    <div className="int-room-chat-msg__bubble is-typing-bubble">
                      <div className="int-room-typing-indicator">
                        <span />
                        <span />
                        <span />
                      </div>
                      <span className="int-room-typing-label">Preparing the next question...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Quick Interaction Suggestions */}
            {!isCompleted && interviewMode === 'text' && (
              <div className="int-room-quick-prompts">
                <span className="int-room-quick-label">Suggestions:</span>
                {[
                  'Could you provide an example scenario?',
                  'Here is my technical approach...',
                  'I would consider trade-offs between latency and throughput...',
                  'Ready for the next question',
                ].map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="int-room-quick-pill"
                    onClick={() => setInputValue(promptText)}
                    disabled={isAiTyping}
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            )}

            {/* Completion Banner */}
            {isCompleted && (
              <div style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', margin: '0 20px 14px', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>✓ Live interview completed. Your responses and conversation transcript have been recorded.</span>
                <button
                  type="button"
                  onClick={() => navigate(`/interview-report?id=${interviewId}`)}
                  style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}
                >
                  View Evaluation Report
                </button>
              </div>
            )}

            {/* ===============================================================
                STAGE BOTTOM INTERACTION AREA:
                - Voice Mode: Hands-Free Voice Dock with 3s Silence Auto-Send & Mute/Unmute
                - Text Mode: Traditional Keyboard Chatbox
                =============================================================== */}
            {interviewMode === 'voice' && !isCompleted && (
              <div className="int-room-voice-dock">
                <div className="int-room-voice-dock__status-bar">
                  <div className="int-room-voice-dock__status">
                    {voiceState === VOICE_STATES.INTERVIEWER_SPEAKING && (
                      <span>🔊 AI Interviewer is speaking... Please listen to the question.</span>
                    )}
                    {voiceState === VOICE_STATES.AI_PROCESSING && (
                      <span>🧠 AI is processing your answer and formulating the next question...</span>
                    )}
                    {voiceState === VOICE_STATES.TRANSCRIBING && (
                      <span>⚡ Finalizing speech transcription with Whisper...</span>
                    )}
                    {voiceState === VOICE_STATES.ERROR && (
                      <span>⚠️ Microphone attention needed. Please check the permission prompt above.</span>
                    )}
                    {isVoiceMuted && voiceState !== VOICE_STATES.INTERVIEWER_SPEAKING && voiceState !== VOICE_STATES.AI_PROCESSING && (
                      <span>🔇 Microphone is MUTED. Click Unmute when you are ready to speak your answer.</span>
                    )}
                    {!isVoiceMuted && voiceState === VOICE_STATES.CANDIDATE_SPEAKING && silenceCountdown > 0 && (
                      <span>⏱️ Silence detected. Auto-sending your answer in <strong>{silenceCountdown}s</strong>...</span>
                    )}
                    {!isVoiceMuted && voiceState === VOICE_STATES.CANDIDATE_SPEAKING && silenceCountdown === 0 && liveTranscript && (
                      <span>🔴 Microphone is LIVE. Speaking... (Auto-sends 3s after you finish talking)</span>
                    )}
                    {!isVoiceMuted && (voiceState === VOICE_STATES.CANDIDATE_SPEAKING || voiceState === VOICE_STATES.WAITING_FOR_CANDIDATE) && !liveTranscript && silenceCountdown === 0 && (
                      <span>🎤 Microphone is LIVE and listening. Speak your answer anytime (auto-sends 3s after you finish).</span>
                    )}
                  </div>
                </div>

                <div className="int-room-voice-dock__actions">
                  {/* Mute / Unmute Button */}
                  <button
                    type="button"
                    className={`int-room-voice-dock__toggle-btn ${isVoiceMuted ? 'is-muted-btn' : 'is-live-btn'}`}
                    onClick={handleToggleMute}
                    disabled={
                      voiceState === VOICE_STATES.AI_PROCESSING ||
                      voiceState === VOICE_STATES.TRANSCRIBING ||
                      isAiTyping ||
                      isCompleted
                    }
                    title={
                      isVoiceMuted
                        ? 'Click to Unmute Microphone'
                        : voiceState === VOICE_STATES.INTERVIEWER_SPEAKING
                        ? 'Click to Unmute & Answer Immediately'
                        : 'Click to Mute Microphone'
                    }
                  >
                    <span>
                      {isVoiceMuted
                        ? '🎙️ Unmute Microphone'
                        : voiceState === VOICE_STATES.INTERVIEWER_SPEAKING
                        ? '🔊 Interviewer Speaking (Click to Answer)'
                        : '🔇 Mute Microphone'}
                    </span>
                  </button>

                  {/* Send Answer Now Button (Available if candidate has spoken text and doesn't want to wait 3s) */}
                  {liveTranscript.trim().length > 0 && voiceState === VOICE_STATES.CANDIDATE_SPEAKING && (
                    <button
                      type="button"
                      className="int-room-voice-dock__send-btn"
                      onClick={() => handleCommitCandidateSpeech()}
                      title="Send answer immediately without waiting for 3s silence"
                    >
                      <span>🚀 Send Now {silenceCountdown > 0 ? `(${silenceCountdown}s)` : ''}</span>
                    </button>
                  )}

                  {/* Replay Question Button */}
                  {latestAiQuestion && (
                    <button
                      type="button"
                      className="int-room-voice-dock__replay-btn"
                      onClick={() => handleSynthesizeSpeech(latestAiQuestion.text, latestAiQuestion.id)}
                      disabled={voiceState === VOICE_STATES.INTERVIEWER_SPEAKING || voiceState === VOICE_STATES.AI_PROCESSING}
                      title="Replay interviewer's question aloud"
                    >
                      <span>🔊 Replay Question</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Text Mode Chatbox (Rendered ONLY in Text Mode) */}
            {interviewMode === 'text' && (
              <form className="int-room-stage-form" onSubmit={handleSendMessage}>
                {/* Microphone Toggle Button */}
                <button
                  type="button"
                  className={`int-room-input-mic-btn ${isAudioOn ? 'is-active' : 'is-muted'}`}
                  onClick={handleToggleAudio}
                  title={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
                  aria-label="Toggle Microphone"
                  disabled={isCompleted}
                >
                  <img src={audioIcon} alt="Mic" className="int-room-input-mic-icon" />
                  {!isAudioOn && <span className="int-room-input-mic-strike" />}
                </button>

                {/* Code Snippet Insert Button */}
                <button
                  type="button"
                  className="int-room-input-attach-btn"
                  title="Attach code snippet"
                  disabled={isCompleted || isAiTyping}
                  onClick={() => {
                    setInputValue((prev) =>
                      prev ? `${prev}\n\`\`\`javascript\n// Code snippet\n\`\`\`` : '```javascript\n// Code snippet\n```'
                    )
                  }}
                >
                  <img src={attachmentIcon} alt="Attach" className="int-room-input-attach-icon" />
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  className="int-room-stage-input"
                  placeholder={
                    isCompleted
                      ? 'Interview completed.'
                      : 'Type your response here...'
                  }
                  value={inputValue}
                  disabled={isCompleted || isAiTyping}
                  onChange={(e) => setInputValue(e.target.value)}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  className="int-room-stage-send-btn"
                  disabled={!inputValue.trim() || isAiTyping || isCompleted}
                  title="Send response"
                  aria-label="Send response"
                >
                  <img src={sendIcon} alt="Send" className="int-room-stage-send-icon" />
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* =====================================================================
          INTERVIEW MODE SELECTION MODAL (Prompted at begin of interview)
          ===================================================================== */}
      {isModeModalOpen && (
        <div className="int-room-mode-overlay" role="dialog" aria-modal="true" aria-labelledby="mode-modal-title">
          <div className="int-room-mode-modal">
            <div className="int-room-mode-header">
              <div className="int-room-mode-badge">HireMind AI Interview Experience</div>
              <h2 id="mode-modal-title" className="int-room-mode-title">Choose Your Interview Format</h2>
              <p className="int-room-mode-subtitle">
                Select how you would like to interact with the AI interviewer for the <strong>{displayRole}</strong> position at <strong>{displayCompany}</strong>.
              </p>
            </div>

            <div className="int-room-mode-grid">
              {/* Voice-Based Interview Card */}
              <div className="int-room-mode-card is-voice" onClick={() => handleSelectMode('voice')}>
                <div className="int-room-mode-card__badge">Recommended • Hands-Free</div>
                <div className="int-room-mode-card__icon-wrap">
                  <span className="int-room-mode-card__icon">🎙️</span>
                </div>
                <h3 className="int-room-mode-card__title">Voice-Based Interview</h3>
                <p className="int-room-mode-card__desc">
                  The AI interviewer asks questions aloud automatically. You answer naturally using your microphone, with live speech transcription typed directly on screen.
                </p>
                <ul className="int-room-mode-card__features">
                  <li>✓ AI automatically reads questions aloud</li>
                  <li>✓ Real-time speech typing — words appear as you speak</li>
                  <li>✓ Simple microphone ON / OFF controls (no chatbox needed)</li>
                  <li>✓ Realistic, immersive conversational practice</li>
                </ul>
                <button
                  type="button"
                  className="int-room-mode-card__action-btn is-voice"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectMode('voice')
                  }}
                >
                  Start Voice Interview →
                </button>
              </div>

              {/* Text-Based Interview Card */}
              <div className="int-room-mode-card is-text" onClick={() => handleSelectMode('text')}>
                <div className="int-room-mode-card__badge is-muted">Standard Format</div>
                <div className="int-room-mode-card__icon-wrap">
                  <span className="int-room-mode-card__icon">💬</span>
                </div>
                <h3 className="int-room-mode-card__title">Text-Based Interview</h3>
                <p className="int-room-mode-card__desc">
                  Traditional format with on-screen reading and keyboard input. Type your responses and insert code snippets at your own pace.
                </p>
                <ul className="int-room-mode-card__features">
                  <li>✓ Read questions on screen</li>
                  <li>✓ Type responses using the keyboard chatbox</li>
                  <li>✓ Insert formatted code snippets</li>
                  <li>✓ Self-paced response writing</li>
                </ul>
                <button
                  type="button"
                  className="int-room-mode-card__action-btn is-text"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectMode('text')
                  }}
                >
                  Start Text Interview →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Assistant Drawer */}
      {isChatOpen && (
        <div className="int-room-chat-drawer">
          <div className="int-room-chat-header">
            <div className="int-room-chat-title">
              <img src={chatbotIcon} alt="" className="int-room-chat-bot-icon" />
              <span>HireMind AI Coach</span>
            </div>
            <button
              type="button"
              className="int-room-chat-close"
              onClick={() => setIsChatOpen(false)}
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>
          <div className="int-room-chat-body">
            <div className="int-room-chat-bubble bot">
              Tip for {displayRole}: Be sure to discuss both high-level design choices and low-level edge case handling!
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

