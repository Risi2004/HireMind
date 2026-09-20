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
import './InterviewRoom.css'

export default function InterviewRoom() {
  const navigate = useNavigate()
  const { token } = useParams()

  // Live Timer state (starting around 12:35 = 755 seconds for realism, or live counting)
  const [secondsElapsed, setSecondsElapsed] = useState(755)
  const [isRecording, setIsRecording] = useState(true)

  // Live timer interval tick
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Audio/Video control states
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [hasCameraStream, setHasCameraStream] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [audioVolume, setAudioVolume] = useState(0)

  // Media Stream & Video Element references
  const videoElementRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)

  // Live Transcript state
  const [transcriptMessages, setTranscriptMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      senderName: 'AI Interviewer',
      time: '12:28',
      text: "Welcome Jazeel! Let's move to Question 3: Could you walk me through how you would architect a distributed cache with Spring Boot to handle high-concurrency read traffic?",
    },
    {
      id: 2,
      sender: 'candidate',
      senderName: 'You',
      time: '12:32',
      text: "I would implement a multi-tier caching strategy using Redis as the distributed store with local Caffeine L1 caches to minimize network latency...",
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [activeMobileTab, setActiveMobileTab] = useState('center') // 'context' | 'center' | 'feed'
  const transcriptEndRef = useRef(null)

  // Start Camera Hardware
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported by your browser')
      }

      // Stop any existing video tracks first
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop()
          mediaStreamRef.current.removeTrack(t)
        })
      }

      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 360 },
          facingMode: 'user',
        },
      })

      const newVideoTrack = videoStream.getVideoTracks()[0]
      if (!newVideoTrack) throw new Error('No video track available')

      if (mediaStreamRef.current) {
        mediaStreamRef.current.addTrack(newVideoTrack)
      } else {
        mediaStreamRef.current = new MediaStream([newVideoTrack])
      }

      setHasCameraStream(true)
      setIsVideoOn(true)
      setCameraError(null)

      if (videoElementRef.current) {
        videoElementRef.current.srcObject = mediaStreamRef.current
        videoElementRef.current.play().catch(() => {})
      }
    } catch (err) {
      console.warn('Failed to start camera hardware:', err)
      setHasCameraStream(false)
      setIsVideoOn(false)
      setCameraError(err.message || 'Camera permission denied')
      alert('Could not access camera. Please make sure your camera is connected and allowed in your browser permissions.')
    }
  }

  // Stop Camera Hardware (COMPLETELY TURNS OFF LAPTOP CAMERA LED LIGHT)
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach((track) => {
        track.stop() // Releases hardware sensor; physical camera light turns OFF
        mediaStreamRef.current.removeTrack(track)
      })
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null
    }
    setIsVideoOn(false)
  }

  // Start Microphone Hardware
  const startMicrophone = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone is not supported by your browser')
      }

      // Stop any existing audio tracks first
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

      // Connect to audio visualizer equalizer
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
    } catch (err) {
      console.warn('Failed to start microphone hardware:', err)
      setIsAudioOn(false)
      alert('Could not access microphone. Please make sure microphone permissions are allowed in your browser.')
    }
  }

  // Stop Microphone Hardware
  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.stop() // Releases microphone hardware
        mediaStreamRef.current.removeTrack(track)
      })
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    setAudioVolume(0)
    setIsAudioOn(false)
  }

  // Toggle Camera
  const handleToggleVideo = () => {
    if (isVideoOn) {
      stopCamera()
    } else {
      startCamera()
    }
  }

  // Toggle Microphone
  const handleToggleAudio = () => {
    if (isAudioOn) {
      stopMicrophone()
    } else {
      startMicrophone()
    }
  }

  // Initialize camera and microphone on mount
  useEffect(() => {
    let isMounted = true

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 360 },
            facingMode: 'user',
          },
          audio: true,
        })

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        mediaStreamRef.current = stream
        setHasCameraStream(true)
        setIsVideoOn(true)
        setIsAudioOn(true)
        setCameraError(null)

        if (videoElementRef.current) {
          videoElementRef.current.srcObject = stream
          videoElementRef.current.play().catch(() => {})
        }

        // Setup audio visualizer
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
        console.warn('Initial dual access error, trying video only:', err)
        try {
          const vidStream = await navigator.mediaDevices.getUserMedia({ video: true })
          if (!isMounted) {
            vidStream.getTracks().forEach((t) => t.stop())
            return
          }
          mediaStreamRef.current = vidStream
          setHasCameraStream(true)
          setIsVideoOn(true)
          setIsAudioOn(false)
          setCameraError(null)

          if (videoElementRef.current) {
            videoElementRef.current.srcObject = vidStream
            videoElementRef.current.play().catch(() => {})
          }
        } catch (vidErr) {
          console.warn('Video access denied or not available:', vidErr)
          if (isMounted) {
            setHasCameraStream(false)
            setIsVideoOn(false)
            setIsAudioOn(false)
            setCameraError(vidErr.message || 'Permission needed')
          }
        }
      }
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      initMedia()
    }

    return () => {
      isMounted = false
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcriptMessages])

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    const newCandidateMsg = {
      id: Date.now(),
      sender: 'candidate',
      senderName: 'You',
      time: formatTimer(secondsElapsed),
      text: inputValue.trim(),
    }

    setTranscriptMessages((prev) => [...prev, newCandidateMsg])
    setInputValue('')

    // Simulated responsive AI follow-up
    setTimeout(() => {
      setTranscriptMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          senderName: 'AI Interviewer',
          time: formatTimer(secondsElapsed + 2),
          text: "That's a very solid approach regarding Redis eviction policies. How would you monitor cache invalidation events across multiple Spring replicas?",
        },
      ])
    }, 1500)
  }

  const handleEndCall = () => {
    const confirmEnd = window.confirm(
      'Are you sure you want to conclude this interview session? Your progress will be saved and you will be directed to your Interview Report.'
    )
    if (confirmEnd) {
      navigate('/interview-report')
    }
  }

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
          <h1 className="int-room-nav__title">Software Engineer Intern</h1>
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
          <ProfileDropdown initial="J" name="Jazeel Jaufer" email="jazeel.jaufer@example.com" />
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="int-room-mobile-tabs">
        <button
          type="button"
          className={`int-room-mobile-tab ${activeMobileTab === 'context' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('context')}
        >
          Session Context
        </button>
        <button
          type="button"
          className={`int-room-mobile-tab ${activeMobileTab === 'center' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('center')}
        >
          AI Stage
        </button>
        <button
          type="button"
          className={`int-room-mobile-tab ${activeMobileTab === 'feed' ? 'is-active' : ''}`}
          onClick={() => setActiveMobileTab('feed')}
        >
          Video & Transcript
        </button>
      </div>

      {/* =====================================================================
          MAIN COCKPIT WORKSPACE (3 Columns: Context, Center Stage, Feed)
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
            {/* Header: QUESTION 3 OF 10 */}
            <div className="int-room-q-header">
              <span className="int-room-q-line" />
              <span className="int-room-q-title">QUESTION 3 OF 10</span>
              <span className="int-room-q-line" />
            </div>

            {/* Item 1: Resume */}
            <div className="int-room-info-item">
              <div className="int-room-info-icon-wrap is-green">
                <img src={tick2Icon} alt="" className="int-room-check-icon" />
              </div>
              <span className="int-room-info-text">Johndoe_resume_2024.Pdf</span>
            </div>

            {/* Item 2: Role */}
            <div className="int-room-info-item">
              <div className="int-room-info-icon-wrap is-slate">
                <svg width="16" height="15" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 5H14V3C14 1.89543 13.1046 1 12 1H8C6.89543 1 6 1.89543 6 3V5H2C0.89543 5 0 5.89543 0 7V15C0 16.1046 0.89543 17 2 17H18C19.1046 17 20 16.1046 20 15V7C20 5.89543 19.1046 5 18 5ZM8 3H12V5H8V3ZM18 15H2V7H18V15Z"
                    fill="#94A3B8"
                  />
                </svg>
              </div>
              <span className="int-room-info-text">Backend Developer</span>
            </div>

            {/* Item 3: Company */}
            <div className="int-room-info-item">
              <div className="int-room-info-icon-wrap is-slate">
                <img src={company1Icon} alt="" className="int-room-building-icon" />
              </div>
              <span className="int-room-info-text">Microsoft</span>
            </div>

            {/* Inset Job Description Box */}
            <div className="int-room-jd-group">
              <div className="int-room-jd-header">
                <span className="int-room-jd-label">JOB DESCRIPTION</span>
                <button
                  type="button"
                  className="int-room-jd-paste"
                  onClick={() => alert('Job description is actively synced from Microsoft posting.')}
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
              </div>

              <div className="int-room-jd-box">
                <p>
                  We are looking for a Senior Backend Developer to build scalable cloud services using Java and Spring Boot. You will architect distributed systems, optimize SQL queries for performance, and collaborate with frontend teams building React applications...
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 2: Center Stage AI Listening & Equalizer Gauge HUD
            =================================================================== */}
        <section
          className={`int-room-col int-room-col--center ${
            activeMobileTab === 'center' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          <div className="int-room-gauge-wrapper">
            <div className="int-room-listening-title">
              <span className="int-room-listening-dash">—</span>
              <span className="int-room-listening-dot" />
              AI is Listening...
              <span className="int-room-listening-dash">—</span>
            </div>

            {/* Central Solid Circular Acoustic Disc */}
            <div className="int-room-gauge-circle">
              {/* Dynamic Audio Equalizer Bars */}
              <div className="int-room-voice-equalizer" aria-label="Audio Waveform">
                <span className="eq-bar eq-bar--1" />
                <span className="eq-bar eq-bar--2" />
                <span className="eq-bar eq-bar--3" />
                <span className="eq-bar eq-bar--4" />
                <span className="eq-bar eq-bar--5" />
                <span className="eq-bar eq-bar--6" />
                <span className="eq-bar eq-bar--7" />
                <span className="eq-bar eq-bar--8" />
                <span className="eq-bar eq-bar--9" />
                <span className="eq-bar eq-bar--10" />
                <span className="eq-bar eq-bar--11" />
                <span className="eq-bar eq-bar--12" />
                <span className="eq-bar eq-bar--13" />
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            COLUMN 3: Right Side (Webcam Feed, Controls Dock & Live Transcript)
            =================================================================== */}
        <section
          className={`int-room-col int-room-col--right ${
            activeMobileTab === 'feed' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          {/* Top Video Feed */}
          <div className="int-room-video-card">
            <div className="int-room-video-screen">
              {/* The video element is ALWAYS mounted so ref is never null and stream attaches instantly */}
              <video
                ref={videoElementRef}
                autoPlay
                playsInline
                muted
                className={`int-room-video-stream int-room-video-stream--cam ${
                  !hasCameraStream || !isVideoOn ? 'is-hidden' : ''
                }`}
              />

              {/* Fallback preview with quick Enable button if camera permission was denied or is connecting */}
              {isVideoOn && !hasCameraStream && (
                <div className="int-room-cam-permission-overlay">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=640&auto=format&fit=crop"
                    alt="Candidate Camera Feed Fallback"
                    className="int-room-video-stream"
                  />
                  <div className="int-room-cam-prompt">
                    <span className="int-room-cam-prompt-text">
                      {cameraError ? 'Camera access needed' : 'Connecting camera...'}
                    </span>
                    <button
                      type="button"
                      className="int-room-cam-enable-btn"
                      onClick={startCamera}
                    >
                      Enable Camera
                    </button>
                  </div>
                </div>
              )}

              {!isVideoOn && (
                <div className="int-room-video-placeholder">
                  <div className="int-room-video-avatar">J</div>
                  <span>Camera is turned off</span>
                  <button
                    type="button"
                    className="int-room-cam-enable-btn"
                    onClick={startCamera}
                    style={{ marginTop: '8px' }}
                  >
                    Turn on camera
                  </button>
                </div>
              )}

              <div className="int-room-video-live-tag">
                <span
                  className={`int-room-video-live-dot ${
                    !isVideoOn || !isAudioOn ? 'is-warning' : ''
                  }`}
                />
                {!isVideoOn ? 'CAM OFF' : !isAudioOn ? 'MUTED' : 'LIVE'}
              </div>
            </div>
          </div>

          {/* Floating Vertical Controls Dock */}
          <div className="int-room-controls-dock" aria-label="Media controls">
            {/* Camera Toggle Button */}
            <button
              type="button"
              className={`int-room-dock-btn ${isVideoOn ? 'is-on' : 'is-off'}`}
              onClick={handleToggleVideo}
              title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
              aria-label="Toggle Camera"
            >
              <img src={videoIcon} alt="Video" className="int-room-dock-icon" />
              {!isVideoOn && <span className="int-room-dock-strike" />}
            </button>

            {/* Microphone Toggle Button */}
            <button
              type="button"
              className={`int-room-dock-btn ${isAudioOn ? 'is-on' : 'is-off is-muted'}`}
              onClick={handleToggleAudio}
              title={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
              aria-label="Toggle Microphone"
            >
              <img src={audioIcon} alt="Mic" className="int-room-dock-icon" />
              {!isAudioOn && <span className="int-room-dock-strike" />}
            </button>
          </div>

          {/* Bottom Live Transcript Box */}
          <div className="int-room-transcript-card">
            <div className="int-room-transcript-header">
              <h3 className="int-room-transcript-title">Live Transcript</h3>
            </div>

            {/* Scrollable Dialogue */}
            <div className="int-room-transcript-body">
              {transcriptMessages.map((msg) => (
                <div key={msg.id} className={`int-room-msg-bubble ${msg.sender}`}>
                  <div className="int-room-msg-meta">
                    <span className="int-room-msg-sender">{msg.senderName}</span>
                    <span className="int-room-msg-time">{msg.time}</span>
                  </div>
                  <div className="int-room-msg-text">{msg.text}</div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>

            {/* Bottom Input Area */}
            <form className="int-room-transcript-form" onSubmit={handleSendMessage}>
              <button
                type="button"
                className="int-room-attach-btn"
                title="Attach code snippet or file"
                onClick={() => alert('Code attachment upload enabled.')}
              >
                <img src={attachmentIcon} alt="Attach" className="int-room-attach-icon" />
              </button>

              <input
                type="text"
                className="int-room-transcript-input"
                placeholder="Type here"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />

              <button
                type="submit"
                className="int-room-send-btn"
                title="Send answer"
                disabled={!inputValue.trim()}
              >
                <img src={sendIcon} alt="Send" className="int-room-send-icon" />
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
              Tip for Question 3: Remember to mention fault-tolerance and cache stampede protection!
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
