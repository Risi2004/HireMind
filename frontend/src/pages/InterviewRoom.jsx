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

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((t) => {
          t.stop()
          mediaStreamRef.current.removeTrack(t)
        })
      }

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const newAudioTrack = audioStream.getAudioTracks()[0]
      if (!newAudioTrack) throw new Error('No audio track available')

      if (mediaStreamRef.current) {
        mediaStreamRef.current.addTrack(newAudioTrack)
      } else {
        mediaStreamRef.current = new MediaStream([newAudioTrack])
      }

      setIsAudioOn(true)

      // Audio volume meter
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new AudioCtx()
          }
          const audioCtx = audioContextRef.current
          const source = audioCtx.createMediaStreamSource(new MediaStream([newAudioTrack]))
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
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.stop()
        mediaStreamRef.current.removeTrack(track)
      })
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    setAudioVolume(0)
    setIsAudioOn(false)
  }

  const handleToggleAudio = () => {
    if (isAudioOn) {
      stopMicrophone()
    } else {
      startMicrophone()
    }
  }

  // Initialize microphone on mount
  useEffect(() => {
    let isMounted = true
    const initAudio = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        mediaStreamRef.current = stream
        setIsAudioOn(true)

        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext
          if (AudioCtx) {
            const audioCtx = new AudioCtx()
            audioContextRef.current = audioCtx
            const source = audioCtx.createMediaStreamSource(stream)
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
          console.warn('Audio analyzer error:', e)
        }
      } catch (err) {
        console.warn('Microphone permission needed or unavailable:', err)
        if (isMounted) setIsAudioOn(false)
      }
    }

    initAudio()

    return () => {
      isMounted = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
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
  const [voiceState, setVoiceState] = useState(VOICE_STATES.INITIALIZING)
  const [voiceError, setVoiceError] = useState(null)
  const [lastTranscript, setLastTranscript] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [playingMessageId, setPlayingMessageId] = useState(null)

  // MediaRecorder references
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const currentAudioPlayerRef = useRef(null)
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
    setPlayingMessageId(null)
  }

  // Play Interviewer TTS Audio with strict Turn-Taking protection
  const playInterviewerAudio = (audioUrl, messageId = null) => {
    if (!audioUrl) {
      setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      return
    }

    stopCurrentAudio()

    try {
      const audio = new Audio(audioUrl)
      currentAudioPlayerRef.current = audio
      setPlayingMessageId(messageId)
      // Turn-taking rule: Disable candidate recording while interviewer is speaking
      setVoiceState(VOICE_STATES.INTERVIEWER_SPEAKING)
      setVoiceError(null)

      audio.onended = () => {
        setPlayingMessageId(null)
        currentAudioPlayerRef.current = null
        setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      }

      audio.onerror = (e) => {
        console.warn('[VoiceMode] Audio playback error:', e)
        setPlayingMessageId(null)
        currentAudioPlayerRef.current = null
        setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      }

      audio.play().catch((err) => {
        console.warn('[VoiceMode] Audio autoplay was prevented or delayed:', err)
        setPlayingMessageId(null)
        currentAudioPlayerRef.current = null
        setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      })
    } catch (err) {
      console.warn('[VoiceMode] playInterviewerAudio exception:', err)
      setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
    }
  }

  // Synthesize and play speech on-demand for any AI message
  const handleSynthesizeSpeech = async (text, messageId) => {
    if (!text) return
    if (audioCacheRef.current.has(messageId)) {
      playInterviewerAudio(audioCacheRef.current.get(messageId), messageId)
      return
    }

    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/voice/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ text }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.audioUrl) {
          audioCacheRef.current.set(messageId, data.audioUrl)
          playInterviewerAudio(data.audioUrl, messageId)
        }
      } else {
        console.warn('[VoiceMode] TTS speech synthesis returned status:', res.status)
      }
    } catch (err) {
      console.warn('[VoiceMode] TTS synthesis request failed:', err)
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

  // Authoritative Adaptive Live Interview Initialization
  useEffect(() => {
    if (!interviewId || interviewId === 'default' || hasInitializedRef.current) return
    hasInitializedRef.current = true

    const startOrResumeInterview = async () => {
      try {
        setVoiceState(VOICE_STATES.INITIALIZING)
        const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
        const res = await fetch(`http://localhost:5000/api/interview/${interviewId}/begin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
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
            setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
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

            if (data.audioUrl) {
              audioCacheRef.current.set(openMsgId, data.audioUrl)
              playInterviewerAudio(data.audioUrl, openMsgId)
            } else {
              setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
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

    startOrResumeInterview()
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
            setVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
          }

          // If TTS audio returned, play it
          if (data.audioUrl) {
            audioCacheRef.current.set(aiMsgId, data.audioUrl)
            playInterviewerAudio(data.audioUrl, aiMsgId)
          } else if (interviewMode === 'voice') {
            // Background fetch TTS if not inlined
            handleSynthesizeSpeech(data.nextQuestion, aiMsgId)
            setVoiceState(data.isComplete ? VOICE_STATES.INTERVIEW_COMPLETE : VOICE_STATES.WAITING_FOR_CANDIDATE)
          } else {
            setVoiceState(data.isComplete ? VOICE_STATES.INTERVIEW_COMPLETE : VOICE_STATES.WAITING_FOR_CANDIDATE)
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
     VOICE RECORDING CONTROLS (MediaRecorder -> Whisper STT)
     ========================================================================= */
  // 1. Candidate Clicks [ Start Answer ]
  const handleStartAnswer = async () => {
    if (voiceState !== VOICE_STATES.WAITING_FOR_CANDIDATE && voiceState !== VOICE_STATES.ERROR) {
      return
    }
    if (isAiTyping || isCompleted) return

    // Ensure audio playback is stopped
    stopCurrentAudio()
    setVoiceError(null)

    try {
      let stream = mediaStreamRef.current
      if (!stream || stream.getAudioTracks().length === 0 || !stream.getAudioTracks()[0].enabled) {
        stream = await startMicrophone()
      }

      // Check supported MIME type
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
        handleProcessRecordedAudio(audioBlob)
      }

      recorder.start(250) // collect chunks every 250ms
      setVoiceState(VOICE_STATES.CANDIDATE_SPEAKING)
      setRecordingSeconds(0)

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('[VoiceMode] Failed to start MediaRecorder:', err)
      setVoiceState(VOICE_STATES.ERROR)
      setVoiceError({
        code: 'MICROPHONE_PERMISSION_DENIED',
        message: 'Microphone permission was denied or microphone hardware is unavailable.',
        canRetry: true,
        canSwitchToText: true,
      })
    }
  }

  // 2. Candidate Clicks [ Stop Answer ]
  const handleStopAnswer = () => {
    if (voiceState !== VOICE_STATES.CANDIDATE_SPEAKING) return

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setVoiceState(VOICE_STATES.TRANSCRIBING)
      mediaRecorderRef.current.stop()
    }
  }

  // 3. Process Recorded Audio Blob -> Whisper Large V3 Turbo
  const handleProcessRecordedAudio = async (audioBlob) => {
    // Validate audio size (minimum ~1000 bytes)
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

      // Reject empty or invalid transcription
      if (!transcript || data.success === false) {
        setVoiceState(VOICE_STATES.ERROR)
        setVoiceError({
          code: 'EMPTY_TRANSCRIPT',
          message: "We couldn't clearly capture that answer. Please try again.",
          canRetry: true,
          canSwitchToText: true,
        })
        return
      }

      // Valid authentic transcript!
      setLastTranscript(transcript)
      // Send authentic transcript to the existing Interview Agent
      submitCandidateAnswer(transcript, 'voice', durationSnapshot, data.latencyMs)
    } catch (err) {
      console.warn('[VoiceMode] STT processing error:', err)
      setVoiceState(VOICE_STATES.ERROR)
      setVoiceError({
        code: 'STT_FAILED',
        message: 'Speech recognition was unable to transcribe your response. You can retry recording or type your answer.',
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
          {/* Mode Switcher: Voice Mode vs Text Mode */}
          <div className="int-room-mode-toggle" role="group" aria-label="Interview Mode">
            <button
              type="button"
              className={`int-room-mode-toggle-btn ${interviewMode === 'voice' ? 'is-active' : ''}`}
              onClick={() => {
                setInterviewMode('voice')
                if (voiceState === VOICE_STATES.INITIALIZING) {
                  setVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
                }
              }}
              title="Switch to Voice Interview Mode (Whisper STT + Gemini TTS)"
            >
              <span>🎙 Voice</span>
            </button>
            <button
              type="button"
              className={`int-room-mode-toggle-btn ${interviewMode === 'text' ? 'is-active' : ''}`}
              onClick={() => {
                setInterviewMode('text')
                stopCurrentAudio()
                if (voiceState === VOICE_STATES.CANDIDATE_SPEAKING) {
                  handleStopAnswer()
                }
              }}
              title="Switch to Text Interview Mode"
            >
              <span>💬 Text</span>
            </button>
          </div>

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
                  className={`int-room-mic-status-pill ${isAudioOn ? 'is-active' : 'is-muted'}`}
                  onClick={handleToggleAudio}
                  title={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
                  aria-label="Toggle Microphone"
                >
                  <img src={audioIcon} alt="Mic" className="int-room-mic-status-icon" />
                  <span>{isAudioOn ? 'Mic Active' : 'Muted'}</span>
                  {isAudioOn && audioVolume > 5 && <span className="int-room-mic-wave-pulse" />}
                </button>
              </div>
            </div>

            {/* ===============================================================
                VOICE COCKPIT DECK (Active during Voice Interview Mode)
                =============================================================== */}
            {interviewMode === 'voice' && !isCompleted && (
              <div className="int-room-voice-deck">
                {/* Voice Status Bar */}
                <div className="int-room-voice-status-bar">
                  {voiceState === VOICE_STATES.INTERVIEWER_SPEAKING && (
                    <span className="int-room-voice-badge is-speaking">
                      <span className="int-room-pulse-dot is-cyan" />
                      🔊 Interviewer Speaking...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.WAITING_FOR_CANDIDATE && (
                    <span className="int-room-voice-badge is-waiting">
                      <span className="int-room-pulse-dot is-green" />
                      🎤 Ready for your answer
                    </span>
                  )}
                  {voiceState === VOICE_STATES.CANDIDATE_SPEAKING && (
                    <span className="int-room-voice-badge is-recording">
                      <span className="int-room-pulse-dot is-red" />
                      🔴 Recording your answer...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.TRANSCRIBING && (
                    <span className="int-room-voice-badge is-transcribing">
                      <span className="int-room-pulse-dot is-purple" />
                      ⚡ Transcribing speech with Whisper...
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

                {/* Primary & Secondary Recording Controls */}
                <div className="int-room-voice-controls-row">
                  {voiceState === VOICE_STATES.CANDIDATE_SPEAKING ? (
                    <button
                      type="button"
                      className="int-room-voice-btn-primary is-stop"
                      onClick={handleStopAnswer}
                      title="Stop recording and submit answer"
                    >
                      <span>⏹ Stop Answer ({recordingSeconds}s)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="int-room-voice-btn-primary is-start"
                      onClick={handleStartAnswer}
                      disabled={voiceState === VOICE_STATES.INTERVIEWER_SPEAKING || voiceState === VOICE_STATES.TRANSCRIBING || voiceState === VOICE_STATES.AI_PROCESSING || isAiTyping}
                      title={
                        voiceState === VOICE_STATES.INTERVIEWER_SPEAKING
                          ? 'Please wait for the interviewer to finish speaking'
                          : 'Click to speak your answer'
                      }
                    >
                      <span>
                        {voiceState === VOICE_STATES.INTERVIEWER_SPEAKING
                          ? '🔊 Interviewer Speaking...'
                          : voiceState === VOICE_STATES.TRANSCRIBING
                          ? '⚡ Transcribing Answer...'
                          : voiceState === VOICE_STATES.AI_PROCESSING
                          ? '🧠 AI Thinking...'
                          : '🎙️ Start Answer'}
                      </span>
                    </button>
                  )}

                  {/* Replay Question Button */}
                  {latestAiQuestion && (
                    <button
                      type="button"
                      className="int-room-voice-btn-secondary"
                      onClick={() => handleSynthesizeSpeech(latestAiQuestion.text, latestAiQuestion.id)}
                      disabled={voiceState === VOICE_STATES.CANDIDATE_SPEAKING || voiceState === VOICE_STATES.TRANSCRIBING}
                      title="Replay interviewer's question"
                    >
                      <span>🔊 Replay Question</span>
                    </button>
                  )}

                  {/* Quick Switch to Text Mode */}
                  <button
                    type="button"
                    className="int-room-voice-btn-secondary"
                    onClick={() => {
                      setInterviewMode('text')
                      stopCurrentAudio()
                    }}
                    title="Switch to typing your answers"
                  >
                    <span>💬 Type Instead</span>
                  </button>
                </div>

                {/* Last Captured Transcript Preview */}
                {lastTranscript && voiceState !== VOICE_STATES.CANDIDATE_SPEAKING && (
                  <div className="int-room-transcript-preview" title={`Transcribed: ${lastTranscript}`}>
                    <span>✓ Last response transcribed:</span>
                    <span style={{ fontStyle: 'italic', color: '#e2e8f0' }}>"{lastTranscript.slice(0, 90)}{lastTranscript.length > 90 ? '...' : ''}"</span>
                  </div>
                )}

                {/* Error Box & Safe Recovery Options */}
                {voiceError && (
                  <div className="int-room-voice-error-box">
                    <div className="int-room-voice-error-msg">{voiceError.message}</div>
                    <div className="int-room-voice-error-actions">
                      {voiceError.canRetry && (
                        <button
                          type="button"
                          className="int-room-voice-error-btn"
                          onClick={handleStartAnswer}
                        >
                          🔄 Try Recording Again
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

            {/* Stage Bottom Input Bar */}
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
                    : interviewMode === 'voice'
                    ? 'Voice Mode Active: Speak with [Start Answer], or type here...'
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
          </div>
        </section>
      </div>

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

