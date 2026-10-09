import { useState, useEffect, useRef, useEffectEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import recordingDotIcon from '../assets/icons/recording.svg'
import callHangupIcon from '../assets/icons/call.svg'
import audioIcon from '../assets/icons/audio.svg'
import attachmentIcon from '../assets/icons/attachment.svg'
import sendIcon from '../assets/icons/send.svg'
import tick2Icon from '../assets/icons/tick2.svg'
import company1Icon from '../assets/icons/company1.svg'
import chatbotIcon from '../assets/icons/chatbot.svg'
import ProfileDropdown from '../components/ProfileDropdown'
import { useAuth } from '../context/useAuth'
import { getInterviewSession, saveInterviewSession } from '../utils/interviewUtils'
import { getApiUrl } from '../config/api'
import Editor from '@monaco-editor/react'
import './InterviewRoom.css'

const CODE_STARTERS = {
  javascript: `// Write your solution here
function solution() {
  console.log("Hello, HireMind!");
}

solution();
`,
  python: `# Write your solution here
def solution():
    print("Hello, HireMind!")

if __name__ == "__main__":
    solution()
`,
  typescript: `// Write your solution here
function solution(): void {
  console.log("Hello, HireMind!");
}

solution();
`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, HireMind!");
    }
}
`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, HireMind!" << endl;
    return 0;
}
`,
}

const VOICE_STATES = {
  INITIALIZING: 'INITIALIZING',
  PREPARING_SPEECH: 'PREPARING_SPEECH',
  INTERVIEWER_SPEAKING: 'INTERVIEWER_SPEAKING',
  WAITING_FOR_CANDIDATE: 'WAITING_FOR_CANDIDATE',
  CANDIDATE_SPEAKING: 'CANDIDATE_SPEAKING',
  TRANSCRIBING: 'TRANSCRIBING',
  AI_PROCESSING: 'AI_PROCESSING',
  INTERVIEW_COMPLETE: 'INTERVIEW_COMPLETE',
  ERROR: 'ERROR',
}

// Silent clip played during the start click to unlock audio autoplay
const SILENT_WAV = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

// Voice activity detection: average analyser level that counts as speech,
// and how long the candidate must stay quiet before their answer is sent
const VAD_SPEECH_LEVEL = 18
const SILENCE_AUTO_SEND_MS = 2500
// After this much silence we start transcribing the recording in the background,
// so the accurate (Whisper) transcript is usually ready when the answer is sent
const SPECULATIVE_STT_DELAY_MS = 1000
const monotonicNow = () => performance.now()

const countWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length

// Whisper sometimes "hears" these on near-silent audio
const WHISPER_HALLUCINATION = /^(thanks?( you)?( so much)?( for watching)?|you|bye|okay|\.+)[.!]*$/i

// Prefer the server (Whisper) transcript: it is far more accurate than the browser's
// live captions. Fall back to the live text if Whisper looks truncated or hallucinated.
const chooseBestTranscript = (liveText, whisperText) => {
  const live = (liveText || '').trim()
  const whisper = (whisperText || '').trim()
  if (!whisper || WHISPER_HALLUCINATION.test(whisper)) return live
  if (!live) return whisper
  const liveWords = countWords(live)
  const whisperWords = countWords(whisper)
  if (whisperWords < liveWords * 0.5 || whisperWords > liveWords * 2 + 8) return live
  return whisper
}

// Browser speech recognition locale: the candidate's own English variant if they have one
const getRecognitionLang = () => {
  const langs = typeof navigator !== 'undefined' ? (navigator.languages || [navigator.language]) : []
  return langs.find((l) => /^en-[A-Z]{2}$/i.test(l || '')) || 'en-US'
}

let messageIdCounter = 0
// Unique client-side id for transcript messages
const createMessageId = (prefix) => {
  messageIdCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${messageIdCounter}`
}

export default function InterviewRoom() {
  const navigate = useNavigate()
  const { token, id } = useParams()
  const rawId = id || token
  const interviewId = (rawId && rawId !== 'default')
    ? rawId
    : (localStorage.getItem('hiremind_last_interview_id') || 'default')
  const { user, updateDemoQuota, checkInterviewAccessStatus } = useAuth()

  // Strict Interview Termination and Network Abort refs
  const isTerminatedRef = useRef(false)
  const inFlightAbortControllerRef = useRef(new AbortController())

  // (Re)mount: React StrictMode unmounts and remounts once in development and refs
  // survive that. Without this reset the room believed it was already terminated,
  // so the interviewer never spoke and every answer request went out pre-aborted.
  // Declared first so it runs before the effects that start requests.
  useEffect(() => {
    isTerminatedRef.current = false
    if (inFlightAbortControllerRef.current.signal.aborted) {
      inFlightAbortControllerRef.current = new AbortController()
    }
  }, [])

  // Track dynamic session details
  const [session, setSession] = useState(() => getInterviewSession(interviewId) || {})

  useEffect(() => {
    if (!interviewId || interviewId === 'default') {
      return
    }

    // Keep active session ID saved in browser storage
    localStorage.setItem('hiremind_last_interview_id', interviewId)

    // Fetch fresh dynamic data from backend API (local cache is the initial state)
    const fetchRemoteSession = async () => {
      try {
        const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
        const res = await fetch(getApiUrl(`/api/interview/${interviewId}`), {
          headers: {
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
          signal: inFlightAbortControllerRef.current?.signal,
        })
        if (res.ok) {
          const data = await res.json()
          if (data.session) {
            setSession((prev) => ({ ...prev, ...data.session }))
            saveInterviewSession(data.session)
            if (data.session.sessionId) {
              localStorage.setItem('hiremind_last_interview_id', data.session.sessionId)
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[InterviewRoom] Remote session fetch notice:', err)
        }
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
  const [isPaused, setIsPaused] = useState(false)
  const [isEndModalOpen, setIsEndModalOpen] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const isPausedRef = useRef(false)
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // Audio / Microphone hardware references
  const [isAudioOn, setIsAudioOn] = useState(true)
  const [audioVolume, setAudioVolume] = useState(0)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)

  const micRequestRef = useRef(null)
  const lastSpeechAtRef = useRef(0)
  const hasSpokenRef = useRef(false)
  // True while browser speech-to-text is running and producing results normally
  const speechRecognitionOkRef = useRef(false)

  // Start Microphone Hardware (concurrent callers share one permission request)
  const startMicrophone = () => {
    const existing = mediaStreamRef.current
    if (existing && existing.getAudioTracks().some((t) => t.readyState === 'live')) {
      return Promise.resolve(existing)
    }
    if (!micRequestRef.current) {
      micRequestRef.current = acquireMicrophone().finally(() => {
        micRequestRef.current = null
      })
    }
    return micRequestRef.current
  }

  const acquireMicrophone = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone is not supported by your browser')
      }

      // Stop any existing tracks before acquiring fresh stream
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        } catch { /* non-critical; safe to ignore */ }
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

          // Only one analyser loop may run at a time
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

          const dataArray = new Uint8Array(analyser.frequencyBinCount)
          let lastMeterUpdate = 0
          const checkVolume = () => {
            if (analyserRef.current !== analyser) return
            analyser.getByteFrequencyData(dataArray)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i]
            }
            const avgVol = sum / dataArray.length
            const now = performance.now()
            if (now - lastMeterUpdate > 100) {
              lastMeterUpdate = now
              setAudioVolume(avgVol)
            }

            // Interruptions are manual ("Excuse Me / Interject"): auto-detecting them from
            // mic volume picked up the interviewer's own voice through the speakers and
            // cut every question off within a fraction of a second.

            // Volume-based silence detection: used when live speech-to-text gives us
            // nothing (unsupported browser or recognition service error)
            if (voiceStateRef.current === VOICE_STATES.CANDIDATE_SPEAKING && !isVoiceMutedRef.current) {
              if (avgVol > VAD_SPEECH_LEVEL) {
                lastSpeechAtRef.current = now
                hasSpokenRef.current = true
              } else if (
                hasSpokenRef.current &&
                !speechRecognitionOkRef.current &&
                !liveTranscriptRef.current &&
                now - lastSpeechAtRef.current > SILENCE_AUTO_SEND_MS + 500
              ) {
                hasSpokenRef.current = false
                voiceHandlersRef.current.handleCommitCandidateSpeech?.()
              }
            }

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
      } catch { /* non-critical; safe to ignore */ }
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



  /* =========================================================================
     VOICE INTERVIEW ARCHITECTURE & STATE MACHINE
     ========================================================================= */

  // Interview Mode: 'voice' | 'text'
  const [interviewMode, setInterviewMode] = useState('voice')
  const interviewModeRef = useRef('voice')
  useEffect(() => {
    interviewModeRef.current = interviewMode
  }, [interviewMode])

  const [voiceState, setVoiceState] = useState(VOICE_STATES.INITIALIZING)
  const [voiceError, setVoiceError] = useState(null)
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

  // Dual Interview Mode - Feedback Coaching State
  const [activeFeedback, setActiveFeedback] = useState(null)
  const [feedbackContext, setFeedbackContext] = useState(null)
  const [pendingTurnData, setPendingTurnData] = useState(null)
  const [isRetryingFeedback, setIsRetryingFeedback] = useState(false)
  const [feedbackError, setFeedbackError] = useState(null)

  // =========================================================================
  // FEATURE 1B: PRE-FLIGHT HARDWARE QUALITY CHECK ("GREEN ROOM") STATE
  // =========================================================================
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false)
  const [micPermissionStatus, setMicPermissionStatus] = useState('checking')
  const [isTestingMicRecording, setIsTestingMicRecording] = useState(false)
  const [testRecordingCountdown, setTestRecordingCountdown] = useState(0)
  const [testAudioBlob, setTestAudioBlob] = useState(null)
  const [testAudioUrl, setTestAudioUrl] = useState(null)
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false)
  const [isPlayingSpeakerTest, setIsPlayingSpeakerTest] = useState(false)
  const [speakerTestPassed, setSpeakerTestPassed] = useState(false)
  const testMediaRecorderRef = useRef(null)
  const testAudioPlayerRef = useRef(null)
  const testAudioChunksRef = useRef([])

  // =========================================================================
  // FEATURE 2A: CANDIDATE BARGE-IN & INTERRUPTION STATE
  // =========================================================================
  const [bargeInToast, setBargeInToast] = useState(null)
  const bargeInToastTimeoutRef = useRef(null)

  // Query microphone permissions
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' })
        .then((perm) => {
          setMicPermissionStatus(perm.state)
          perm.onchange = () => setMicPermissionStatus(perm.state)
        })
        .catch(() => {
          setMicPermissionStatus('prompt')
        })
    } else {
      setMicPermissionStatus('prompt')
    }
  }, [])

  const triggerBargeInToast = (message) => {
    if (bargeInToastTimeoutRef.current) clearTimeout(bargeInToastTimeoutRef.current)
    setBargeInToast(message)
    bargeInToastTimeoutRef.current = setTimeout(() => {
      setBargeInToast(null)
    }, 3500)
  }

  // Handle Candidate Barge-In / Interruption (Feature 2A)
  const handleCandidateBargeIn = () => {
    if (isCompletedRef.current || isTerminatedRef.current) return
    if (
      voiceStateRef.current !== VOICE_STATES.INTERVIEWER_SPEAKING &&
      voiceStateRef.current !== VOICE_STATES.PREPARING_SPEECH
    ) return

    console.log('[BargeIn] Candidate interrupted interviewer speech')
    speechQueueRef.current.splice(0)
    stopCurrentAudio()

    updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
    setPlayingMessageId(null)
    triggerBargeInToast('Interviewer paused — Listening to your response...')

    if (!isVoiceMutedRef.current && interviewModeRef.current === 'voice') {
      startVoiceListening()
    }
  }

  // Play a pleasant 3-tone harmonic chime for Speaker test (Feature 1B)
  const handlePlaySpeakerTestTone = () => {
    if (isPlayingSpeakerTest) return
    setIsPlayingSpeakerTest(true)
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) throw new Error('Web Audio API not supported')
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') ctx.resume()

      const now = ctx.currentTime
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5 harmonic triad

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + idx * 0.16)

        gain.gain.setValueAtTime(0, now + idx * 0.16)
        gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.16 + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.45)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + idx * 0.16)
        osc.stop(now + idx * 0.16 + 0.5)
      })

      setTimeout(() => {
        setIsPlayingSpeakerTest(false)
        setSpeakerTestPassed(true)
      }, 700)
    } catch (err) {
      console.warn('[SpeakerTest] Tone generation failed:', err)
      setIsPlayingSpeakerTest(false)
    }
  }

  // Record 3-second sample for Microphone clarity loopback test (Feature 1B)
  const handleRecordTestSample = async () => {
    if (isTestingMicRecording) return
    try {
      let stream = mediaStreamRef.current
      if (!stream || !stream.getAudioTracks().some((t) => t.readyState === 'live')) {
        stream = await startMicrophone()
      }

      if (!stream) {
        alert('Please allow microphone permissions to test audio.')
        return
      }

      testAudioChunksRef.current = []
      let mimeType = 'audio/webm;codecs=opus'
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      testMediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          testAudioChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(testAudioChunksRef.current, { type: mimeType || 'audio/webm' })
        setTestAudioBlob(blob)
        if (testAudioUrl) URL.revokeObjectURL(testAudioUrl)
        const url = URL.createObjectURL(blob)
        setTestAudioUrl(url)
        setIsTestingMicRecording(false)
        setTestRecordingCountdown(0)
      }

      recorder.start()
      setIsTestingMicRecording(true)
      setTestRecordingCountdown(3)

      let count = 3
      const countInterval = setInterval(() => {
        count -= 1
        setTestRecordingCountdown(count)
        if (count <= 0) {
          clearInterval(countInterval)
          if (recorder.state === 'recording') {
            recorder.stop()
          }
        }
      }, 1000)
    } catch (err) {
      console.warn('[TestRecording] Error starting sample recording:', err)
      setIsTestingMicRecording(false)
      setTestRecordingCountdown(0)
    }
  }

  // Play candidate's test recorded sample
  const handlePlayTestSample = () => {
    if (!testAudioUrl || isPlayingTestAudio) return
    setIsPlayingTestAudio(true)
    const audio = new Audio(testAudioUrl)
    testAudioPlayerRef.current = audio
    audio.onended = () => {
      setIsPlayingTestAudio(false)
      testAudioPlayerRef.current = null
    }
    audio.onerror = () => {
      setIsPlayingTestAudio(false)
      testAudioPlayerRef.current = null
    }
    audio.play().catch(() => {
      setIsPlayingTestAudio(false)
    })
  }

  // Confirm hardware ready and proceed into interview (Feature 1B)
  const handleConfirmHardwareReady = async () => {
    setIsHardwareModalOpen(false)
    unlockAudioPlayback()
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {})
    }

    if (transcriptMessages.length === 0) {
      await startOrResumeInterview('voice', true, chosenMode)
    }
  }

  // Interview Mode & Format Selection Modal state
  const [isModeModalOpen, setIsModeModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState('mode') // 'mode' | 'format'
  const [chosenMode, setChosenMode] = useState(() => {
    return (
      sessionStorage.getItem(`hiremind_int_mode_${interviewId}`) ||
      session?.interviewMode ||
      'HR_SIMULATION'
    )
  })
  const [liveTranscript, setLiveTranscript] = useState('')
  const liveTranscriptRef = useRef('')
  const recognitionRef = useRef(null)
  const voiceStateRef = useRef(VOICE_STATES.INITIALIZING)

  useEffect(() => {
    voiceStateRef.current = voiceState
  }, [voiceState])

  // Keep the ref in sync immediately: async callbacks read it before React re-renders
  const updateVoiceState = (nextState) => {
    voiceStateRef.current = nextState
    setVoiceState(nextState)
  }

  // Latest handlers for long-lived callbacks (audio events, speech recognition,
  // timers, analyser loop) so they never run a stale render's closure
  const voiceHandlersRef = useRef({})

  const updateLiveTranscript = (text) => {
    liveTranscriptRef.current = text
    setLiveTranscript(text)
  }

  // MediaRecorder references
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const recordingStartedAtRef = useRef(0)
  // Incremented whenever a listening turn starts or is abandoned
  const listenSessionRef = useRef(0)
  // Transcript from earlier recognition sessions within the same answer
  const committedTranscriptRef = useRef('')
  const sessionFinalTranscriptRef = useRef('')
  // Background Whisper transcription started during the silence countdown
  const speculativeSttRef = useRef(null)
  const speculativeTimerRef = useRef(null)
  // Interviewer messages waiting to be spoken after the current one (e.g. feedback, then question)
  const speechQueueRef = useRef([])
  const currentAudioPlayerRef = useRef(null)
  const currentUtteranceRef = useRef(null)
  const audioCacheRef = useRef(new Map())

  // Playback session token: bumped on every start/stop so callbacks from an
  // interrupted or superseded playback can never advance the turn.
  const playbackTokenRef = useRef(0)
  const playbackWatchdogRef = useRef(null)
  const speechKeepAliveRef = useRef(null)
  // A single <audio> element unlocked during the user's click, reused for every
  // question so Safari/iOS autoplay rules don't silently block later playback.
  const ttsAudioElRef = useRef(null)

  const clearPlaybackTimers = () => {
    if (playbackWatchdogRef.current) {
      clearTimeout(playbackWatchdogRef.current)
      playbackWatchdogRef.current = null
    }
    if (speechKeepAliveRef.current) {
      clearInterval(speechKeepAliveRef.current)
      speechKeepAliveRef.current = null
    }
  }

  // Call inside a click handler: unlocks audio output for the rest of the session
  const unlockAudioPlayback = () => {
    try {
      if (!ttsAudioElRef.current) {
        ttsAudioElRef.current = new Audio()
      }
      const el = ttsAudioElRef.current
      el.muted = true
      el.src = SILENT_WAV
      el.play().then(() => {
        el.pause()
        el.muted = false
      }).catch(() => {
        el.muted = false
      })
    } catch { /* non-critical; safe to ignore */ }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const warmup = new SpeechSynthesisUtterance(' ')
        warmup.volume = 0
        window.speechSynthesis.speak(warmup)
      }
    } catch { /* non-critical; safe to ignore */ }
  }

  // Stop any active TTS audio playback completely
  const stopCurrentAudio = () => {
    playbackTokenRef.current += 1
    clearPlaybackTimers()
    if (currentAudioPlayerRef.current) {
      const audio = currentAudioPlayerRef.current
      try {
        audio.onended = null
        audio.onerror = null
        audio.onplaying = null
        audio.onloadedmetadata = null
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      } catch { /* non-critical; safe to ignore */ }
      currentAudioPlayerRef.current = null
    }
    if (currentUtteranceRef.current) {
      try {
        currentUtteranceRef.current.onend = null
        currentUtteranceRef.current.onerror = null
      } catch { /* non-critical; safe to ignore */ }
      currentUtteranceRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch { /* non-critical; safe to ignore */ }
    }
    setPlayingMessageId(null)
  }

  // Transition from AI Speech to Candidate Listening
  const handleAiSpeakingFinished = () => {
    clearPlaybackTimers()
    setPlayingMessageId(null)
    currentAudioPlayerRef.current = null
    currentUtteranceRef.current = null

    // Next queued interviewer message (e.g. the question after spoken feedback)
    const next = speechQueueRef.current.shift()
    if (next && !isTerminatedRef.current && !isPausedRef.current) {
      playInterviewerAudio(next.audioUrl, next.id, next.text, { allowAfterComplete: true })
      return
    }

    if (isCompletedRef.current || isTerminatedRef.current) return

    updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)

    if (!isVoiceMutedRef.current && interviewModeRef.current === 'voice' && !isPausedRef.current) {
      voiceHandlersRef.current.startVoiceListening?.()
    }
  }

  // Speak with the browser's built-in voice. Guards against the Chrome bugs where
  // speak() right after cancel() is dropped, and long utterances stop without
  // ever firing onend (which used to leave the room stuck on "Speaking...").
  const speakWithBrowser = (text, messageId, token) => {
    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
    if (!synth || !text) {
      handleAiSpeakingFinished()
      return
    }

    let finished = false
    const finish = () => {
      if (finished || token !== playbackTokenRef.current) return
      finished = true
      currentUtteranceRef.current = null
      handleAiSpeakingFinished()
    }

    updateVoiceState(VOICE_STATES.INTERVIEWER_SPEAKING)
    setPlayingMessageId(messageId)
    setVoiceError(null)

    // Let the preceding cancel() settle before queueing new speech
    setTimeout(() => {
      if (token !== playbackTokenRef.current) return
      try {
        const utterance = new SpeechSynthesisUtterance(text)
        const voices = synth.getVoices() || []
        const preferred =
          voices.find((v) => /^en(-|_)/i.test(v.lang) && /natural|google|neural|samantha|aria|jenny/i.test(v.name)) ||
          voices.find((v) => /^en(-|_)/i.test(v.lang))
        if (preferred) utterance.voice = preferred
        utterance.lang = preferred?.lang || 'en-US'
        utterance.rate = 1.0
        utterance.onend = finish
        utterance.onerror = finish
        currentUtteranceRef.current = utterance
        synth.speak(utterance)

        // Chrome pauses long utterances after ~15s; nudging it keeps speech alive
        speechKeepAliveRef.current = setInterval(() => {
          if (token !== playbackTokenRef.current) return
          if (synth.speaking && !synth.paused) {
            synth.pause()
            synth.resume()
          }
        }, 10000)

        // Watchdog: if onend never fires, hand the turn to the candidate anyway
        const words = text.split(/\s+/).filter(Boolean).length
        const expectedMs = Math.max(6000, (words / 2) * 1000 + 5000)
        playbackWatchdogRef.current = setTimeout(() => {
          if (token !== playbackTokenRef.current) return
          try { synth.cancel() } catch { /* non-critical; safe to ignore */ }
          finish()
        }, expectedMs)
      } catch (err) {
        console.warn('[VoiceMode] Browser speech failed:', err)
        finish()
      }
    }, 80)
  }

  // Play Interviewer TTS Audio with strict Turn-Taking and termination protection
  const playInterviewerAudio = (audioUrl, messageId = null, fallbackText = null, options = {}) => {
    if ((isCompletedRef.current && !options.allowAfterComplete) || isTerminatedRef.current) return

    // Turn-taking: the candidate's mic is closed while the interviewer talks
    stopCandidateCapture()
    stopCurrentAudio()
    const token = playbackTokenRef.current

    if (!audioUrl) {
      speakWithBrowser(fallbackText, messageId, token)
      return
    }

    let settled = false
    const fallbackToBrowser = (reason) => {
      if (settled || token !== playbackTokenRef.current) return
      settled = true
      console.warn('[VoiceMode] Interviewer audio unavailable, using browser voice:', reason)
      clearPlaybackTimers()
      if (currentAudioPlayerRef.current) {
        try {
          currentAudioPlayerRef.current.onended = null
          currentAudioPlayerRef.current.onerror = null
          currentAudioPlayerRef.current.pause()
        } catch { /* non-critical; safe to ignore */ }
        currentAudioPlayerRef.current = null
      }
      speakWithBrowser(fallbackText, messageId, token)
    }
    const finish = () => {
      if (settled || token !== playbackTokenRef.current) return
      settled = true
      handleAiSpeakingFinished()
    }

    try {
      const audio = ttsAudioElRef.current || new Audio()
      ttsAudioElRef.current = audio
      audio.muted = false
      audio.src = audioUrl
      currentAudioPlayerRef.current = audio
      setPlayingMessageId(messageId)
      // Turn-taking rule: candidate microphone stays closed while interviewer is speaking
      updateVoiceState(VOICE_STATES.INTERVIEWER_SPEAKING)
      setVoiceError(null)

      audio.onended = finish
      audio.onerror = () => fallbackToBrowser(audio.error)

      // If playback never starts, don't leave the candidate staring at a silent screen
      playbackWatchdogRef.current = setTimeout(() => fallbackToBrowser('playback did not start'), 6000)
      audio.onplaying = () => {
        if (token !== playbackTokenRef.current) return
        if (playbackWatchdogRef.current) clearTimeout(playbackWatchdogRef.current)
        const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration * 1000
          : 60000
        playbackWatchdogRef.current = setTimeout(finish, durationMs + 3000)
      }

      audio.play().catch((err) => fallbackToBrowser(err))
    } catch (err) {
      fallbackToBrowser(err)
    }
  }

  // Synthesize and play speech on-demand for any AI message (Listen / Replay buttons)
  const handleSynthesizeSpeech = async (text, messageId) => {
    if (!text || isCompletedRef.current || isTerminatedRef.current) return

    const existingAudio = audioCacheRef.current.get(messageId) || transcriptMessages.find((m) => m.id === messageId)?.audioUrl
    if (existingAudio) {
      audioCacheRef.current.set(messageId, existingAudio)
      playInterviewerAudio(existingAudio, messageId, text)
      return
    }

    // Close the mic while we fetch the voice so the candidate isn't recorded mid-request
    speechQueueRef.current.splice(0)
    stopCandidateCapture()
    stopCurrentAudio()
    updateVoiceState(VOICE_STATES.PREPARING_SPEECH)
    setPlayingMessageId(messageId)
    const requestToken = playbackTokenRef.current

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)
    const abortOnTerminate = () => controller.abort()
    const terminateSignal = inFlightAbortControllerRef.current?.signal
    terminateSignal?.addEventListener('abort', abortOnTerminate)

    let audioUrl = null
    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl(`/api/interview/${interviewId}/voice/speech`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        audioUrl = data.audioUrl || null
      }
    } catch (err) {
      console.warn('[VoiceMode] TTS synthesis notice, using native speech:', err)
    } finally {
      clearTimeout(timeoutId)
      terminateSignal?.removeEventListener('abort', abortOnTerminate)
    }

    // Candidate interrupted or ended the interview while we were waiting
    if (isCompletedRef.current || isTerminatedRef.current || requestToken !== playbackTokenRef.current) return

    if (audioUrl) audioCacheRef.current.set(messageId, audioUrl)
    playInterviewerAudio(audioUrl, messageId, text)
  }

  // Speak a freshly received interviewer message. The backend already tried TTS,
  // so when it sent no audio we go straight to the browser voice instead of
  // waiting on a second synthesis round-trip.
  const speakInterviewerMessage = (text, messageId, audioUrl) => {
    if (isCompletedRef.current || isTerminatedRef.current) {
      updateVoiceState(isCompletedRef.current ? VOICE_STATES.INTERVIEW_COMPLETE : VOICE_STATES.WAITING_FOR_CANDIDATE)
      return
    }
    if (audioUrl) audioCacheRef.current.set(messageId, audioUrl)
    if (interviewModeRef.current !== 'voice') {
      updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      return
    }
    playInterviewerAudio(audioUrl || null, messageId, text)
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
  const isCompletedRef = useRef(false)
  const isAiTypingRef = useRef(false)
  useEffect(() => {
    isCompletedRef.current = isCompleted
  }, [isCompleted])
  useEffect(() => {
    isAiTypingRef.current = isAiTyping
  }, [isAiTyping])
  const setAiTyping = (value) => {
    isAiTypingRef.current = value
    setIsAiTyping(value)
  }

  // Dynamic Live Timer effect (pauses when isPaused or isCompleted)
  useEffect(() => {
    if (isPaused || isCompleted) return
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [isPaused, isCompleted])

  // Code Studio & Sandbox IDE State
  const [isCodeStudioOpen, setIsCodeStudioOpen] = useState(false)
  const [codeLanguage, setCodeLanguage] = useState('javascript')
  const [codeContent, setCodeContent] = useState(CODE_STARTERS.javascript)
  const [codeStdin, setCodeStdin] = useState('')
  const [isStdinOpen, setIsStdinOpen] = useState(false)
  const [codeExplanation, setCodeExplanation] = useState('')
  const [codeOutput, setCodeOutput] = useState(null)
  const [isCodeRunning, setIsCodeRunning] = useState(false)
  const [isCodeSubmitting, setIsCodeSubmitting] = useState(false)
  const hasAutoOpenedCodeRef = useRef(false)

  const handleLanguageChange = (newLang) => {
    setCodeLanguage(newLang)
    if (!codeContent.trim() || Object.values(CODE_STARTERS).some((s) => s.trim() === codeContent.trim())) {
      setCodeContent(CODE_STARTERS[newLang] || '')
    }
  }

  const handleRunCode = async () => {
    if (!codeContent.trim() || isCodeRunning) return
    setIsCodeRunning(true)
    setCodeOutput(null)

    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl(`/api/interview/${interviewId}/code/run`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          code: codeContent,
          language: codeLanguage,
          stdin: codeStdin,
        }),
      })

      const data = await res.json()
      setCodeOutput(data)
    } catch (err) {
      console.warn('[InterviewRoom] Code execution error:', err)
      setCodeOutput({
        success: false,
        stderr: 'Sandbox connection error: ' + (err.message || 'Execution failed'),
        status: 'Error',
      })
    } finally {
      setIsCodeRunning(false)
    }
  }

  const handleSubmitCodeSolution = async () => {
    if (!codeContent.trim() || isCodeSubmitting || isAiTyping || isCompletedRef.current || isTerminatedRef.current) return
    setIsCodeSubmitting(true)
    stopCurrentAudio()

    const candidateCodeMsg = {
      id: createMessageId('cand-code'),
      sender: 'candidate',
      senderName: user?.firstName || 'You',
      time: formatTimer(secondsElapsed),
      text: `Submitted ${codeLanguage.toUpperCase()} Solution`,
      isCode: true,
      codeSnippet: codeContent,
      codeLanguage,
      codeOutput: codeOutput?.stdout || codeOutput?.compile_output || codeOutput?.stderr || '',
      explanation: codeExplanation,
    }

    setTranscriptMessages((prev) => [...prev, candidateCodeMsg])
    setAiTyping(true)
    updateVoiceState(VOICE_STATES.AI_PROCESSING)

    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl(`/api/interview/${interviewId}/code/submit`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          code: codeContent,
          language: codeLanguage,
          explanation: codeExplanation,
          runOutput: codeOutput?.stdout || codeOutput?.compile_output || codeOutput?.stderr || '',
          durationSeconds: secondsElapsed,
          mode: interviewModeRef.current,
          includeAudio: interviewModeRef.current === 'voice',
        }),
        signal: inFlightAbortControllerRef.current?.signal,
      })

      if (isCompletedRef.current || isTerminatedRef.current) return

      if (res.ok) {
        const data = await res.json()
        if (isCompletedRef.current || isTerminatedRef.current) return

        if (data.interviewState) {
          setInterviewState(data.interviewState)
        }

        if (data.feedback) {
          // Feedback Interview Mode: Hold next turn and display immediate coaching panel
          setActiveFeedback(data.feedback)
          setFeedbackContext({
            question: latestAiQuestion?.text || 'Coding Task Solution',
            answer: `[${codeLanguage.toUpperCase()}]\n${codeContent}\n\nExplanation: ${codeExplanation || 'None provided'}`,
          })
          setPendingTurnData({
            nextQuestion: data.nextQuestion,
            stage: data.stage || 'Evaluation & Next Stage',
            audioUrl: data.audioUrl,
            isComplete: Boolean(data.isComplete),
            demoAccess: data.demoAccess,
            interviewState: data.interviewState,
          })
          setAiTyping(false)
          updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
          return
        }

        if (data.nextQuestion) {
          const aiMsgId = createMessageId('ai-code')
          const aiMsg = {
            id: aiMsgId,
            sender: 'ai',
            senderName: 'HireMind AI Interviewer',
            time: formatTimer(secondsElapsed + 2),
            stage: data.stage || 'Evaluation & Next Stage',
            text: data.nextQuestion,
            isCodeReview: true,
          }
          setTranscriptMessages((prev) => [...prev, aiMsg])
          setAiTyping(false)

          speakInterviewerMessage(data.nextQuestion, aiMsgId, data.audioUrl)
          return
        }

        if (data.isComplete) {
          if (data.demoAccess && updateDemoQuota) {
            updateDemoQuota(data.demoAccess)
          }
          if (checkInterviewAccessStatus) {
            checkInterviewAccessStatus().catch(() => {})
          }
          setIsCompleted(true)
          updateVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
          setAiTyping(false)
          return
        }
      } else {
        throw new Error(`Server returned status ${res.status}`)
      }
    } catch (err) {
      if (err.name === 'AbortError' || isTerminatedRef.current) return
      console.warn('[InterviewRoom] Code submission error:', err)
      setVoiceError({
        code: 'CODE_SUBMIT_FAILED',
        message: 'Could not submit code solution to interviewer. Please retry.',
        canRetry: true,
        canSwitchToText: false,
      })
      updateVoiceState(VOICE_STATES.ERROR)
      setAiTyping(false)
    } finally {
      setIsCodeSubmitting(false)
    }
  }

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Handler when user selects interview mode (HR Simulation vs Feedback Coaching)
  const handleChooseInterviewMode = (mode) => {
    setChosenMode(mode)
    sessionStorage.setItem(`hiremind_int_mode_${interviewId}`, mode)
    setSession((prev) => ({
      ...prev,
      interviewMode: mode,
      interviewState: {
        ...(prev?.interviewState || {}),
        interviewMode: mode,
      },
    }))

    // Sync to MongoDB session
    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      fetch(getApiUrl(`/api/interview/${interviewId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ interviewMode: mode }),
      }).catch(() => {})
    } catch { /* non-critical */ }

    // Transition to Format Selection (Voice vs Text)
    setModalStep('format')
  }

  // Handler when user selects format (Voice vs Text) from modal
  const handleSelectMode = async (selectedFormat, modeToUse = chosenMode) => {
    setIsModeModalOpen(false)
    setInterviewMode(selectedFormat)
    sessionStorage.setItem(`hiremind_mode_${interviewId}`, selectedFormat)
    sessionStorage.setItem(`hiremind_int_mode_${interviewId}`, modeToUse)

    // Ensure session state has latest mode
    setSession((prev) => ({
      ...prev,
      interviewMode: modeToUse,
      interviewState: {
        ...(prev?.interviewState || {}),
        interviewMode: modeToUse,
      },
    }))

    // Sync to MongoDB
    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      fetch(getApiUrl(`/api/interview/${interviewId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({ interviewMode: modeToUse }),
      }).catch(() => {})
    } catch { /* non-critical */ }

    if (selectedFormat === 'voice') {
      // User gesture: unlock AudioContext and play a silent buffer so browser autoplay policy is cleared
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx) {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new AudioCtx()
          }
          const ctx = audioContextRef.current
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {})
          }
          // Micro silent buffer to warm up browser audio permissions
          const buffer = ctx.createBuffer(1, 1, 22050)
          const source = ctx.createBufferSource()
          source.buffer = buffer
          source.connect(ctx.destination)
          source.start(0)
        }
      } catch { /* non-critical; safe to ignore */ }
      // Must run inside this click so later interviewer audio is allowed to autoplay
      unlockAudioPlayback()

      // Ask for microphone permission now, while the opening question is being prepared
      startMicrophone().catch((err) => {
        console.warn('Microphone permission request deferred or denied:', err)
      })

      // Directly begin live interview with voice mode and auto-play
      await startOrResumeInterview('voice', true, modeToUse)
    } else {
      await startOrResumeInterview('text', false, modeToUse)
    }
  }

  const startOrResumeInterview = async (mode = 'voice', shouldAutoPlayAudio = true, passedInterviewMode = null) => {
    try {
      const effectiveMode = passedInterviewMode || chosenMode || session?.interviewMode || 'HR_SIMULATION'
      updateVoiceState(VOICE_STATES.INITIALIZING)
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl(`/api/interview/${interviewId}/begin`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          mode,
          includeAudio: mode === 'voice',
          interviewMode: effectiveMode,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.interviewState) {
          setInterviewState(data.interviewState)
          if (data.interviewState.status === 'completed' || data.interviewState.status === 'ended_by_user') {
            setIsCompleted(true)
            updateVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
            return
          }
        }

        if (data.chatMessages && data.chatMessages.length > 0) {
          const mapped = data.chatMessages.map((m, idx) => ({
            id: m._id || createMessageId(`msg-${idx}`),
            sender: m.role === 'candidate' ? 'candidate' : 'ai',
            senderName: m.role === 'candidate' ? (user?.firstName || 'You') : 'HireMind AI Interviewer',
            time: new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            stage: m.metrics?.stageName || data.stage || null,
            text: m.content,
            audioUrl: m.audioUrl || (idx === data.chatMessages.length - 1 ? (data.audioUrl || null) : null),
          }))
          setTranscriptMessages(mapped)
          const lastMsg = mapped[mapped.length - 1]
          const audioToPlay = lastMsg?.audioUrl || data.audioUrl || null
          if (lastMsg && lastMsg.sender === 'ai' && shouldAutoPlayAudio) {
            speakInterviewerMessage(lastMsg.text, lastMsg.id, audioToPlay)
          } else {
            updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
          }
        } else if (data.question) {
          const openMsgId = createMessageId('ai-open')
          setTranscriptMessages([
            {
              id: openMsgId,
              sender: 'ai',
              senderName: 'HireMind AI Interviewer',
              time: '00:00',
              stage: data.stage || 'Introduction',
              text: data.question,
              audioUrl: data.audioUrl || null,
            },
          ])

          // AUTOMATICALLY READ OPENING QUESTION ALOUD IMMEDIATELY
          if (shouldAutoPlayAudio) {
            speakInterviewerMessage(data.question, openMsgId, data.audioUrl)
          } else {
            updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
          }
        } else {
          updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
        }
      } else {
        updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      }
    } catch (err) {
      console.warn('[InterviewRoom] Live interview initialization notice:', err)
      updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
    }
  }

  // Session check on load: if brand new interview, ask user whether they want Voice or Text
  const checkInitialSession = useEffectEvent(async () => {
    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl(`/api/interview/${interviewId}`), {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      })

      if (res.ok) {
        const data = await res.json()
        const sess = data.session || data
        if (sess) {
          if (sess.interviewMode) {
            setChosenMode(sess.interviewMode)
          }

          if (sess.interviewState?.status === 'completed' || sess.interviewState?.status === 'ended_by_user') {
            setIsCompleted(true)
            updateVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
            if (sess.chatMessages) {
              const mapped = sess.chatMessages.map((m, idx) => ({
                id: m._id || createMessageId(`msg-${idx}`),
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
            startOrResumeInterview(modeToUse, false, sess.interviewMode)
            return
          }
        }
      }
    } catch (err) {
      console.warn('[InterviewRoom] Initial check error:', err)
    }

    // Fresh interview: prompt user with Step 1 (Mode Selection: HR vs Feedback)
    setModalStep('mode')
    setIsModeModalOpen(true)
  })

  useEffect(() => {
    if (!interviewId || interviewId === 'default' || hasInitializedRef.current) return
    hasInitializedRef.current = true
    checkInitialSession()
  }, [interviewId])

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
    if (!trimmed || isAiTypingRef.current || isCompletedRef.current || isTerminatedRef.current) return

    speechQueueRef.current.splice(0)
    stopCurrentAudio()
    stopCandidateCapture()

    const questionBeingAnswered =
      latestAiQuestion?.text ||
      transcriptMessages.slice().reverse().find((m) => m.sender === 'ai')?.text ||
      'Current Question'

    const candidateMsg = {
      id: createMessageId('cand'),
      sender: 'candidate',
      senderName: user?.firstName || 'You',
      time: formatTimer(secondsElapsed),
      text: trimmed,
      inputMode,
    }

    setTranscriptMessages((prev) => [...prev, candidateMsg])
    setInputValue('')
    setAiTyping(true)
    updateVoiceState(VOICE_STATES.AI_PROCESSING)
    setVoiceError(null)

    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl(`/api/interview/${interviewId}/answer`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          answer: trimmed,
          inputMode,
          mode: interviewModeRef.current,
          includeAudio: interviewModeRef.current === 'voice',
          durationSeconds,
          sttLatencyMs,
        }),
        signal: inFlightAbortControllerRef.current?.signal,
      })

      if (isCompletedRef.current || isTerminatedRef.current) return

      if (res.ok) {
        const data = await res.json()
        if (isCompletedRef.current || isTerminatedRef.current) return

        if (data.interviewState) {
          setInterviewState(data.interviewState)
        }

        // Voice Feedback Mode: the interviewer says the coaching summary, then asks the
        // next question; no popup interrupts the conversation
        if (data.spokenFeedback && interviewModeRef.current === 'voice') {
          const feedbackMsgId = createMessageId('ai-feedback')
          const newMessages = [{
            id: feedbackMsgId,
            sender: 'ai',
            senderName: 'HireMind AI Interviewer',
            time: formatTimer(secondsElapsed + 1),
            stage: 'Feedback',
            text: data.spokenFeedback,
            audioUrl: data.feedbackAudioUrl || null,
            isFeedback: true,
          }]
          speechQueueRef.current.splice(0)
          if (data.nextQuestion) {
            const questionMsgId = createMessageId('ai')
            newMessages.push({
              id: questionMsgId,
              sender: 'ai',
              senderName: 'HireMind AI Interviewer',
              time: formatTimer(secondsElapsed + 2),
              stage: data.stage || data.interviewState?.currentStageName || null,
              text: data.nextQuestion,
              audioUrl: data.audioUrl || null,
            })
            if (data.audioUrl) audioCacheRef.current.set(questionMsgId, data.audioUrl)
            speechQueueRef.current.push({ audioUrl: data.audioUrl || null, id: questionMsgId, text: data.nextQuestion })
          }
          setTranscriptMessages((prev) => [...prev, ...newMessages])
          setAiTyping(false)

          if (data.isComplete) {
            if (data.demoAccess && updateDemoQuota) updateDemoQuota(data.demoAccess)
            if (checkInterviewAccessStatus) checkInterviewAccessStatus().catch(() => {})
            setIsCompleted(true)
          }

          speakInterviewerMessage(data.spokenFeedback, feedbackMsgId, data.feedbackAudioUrl)
          return
        }

        if (data.feedback) {
          // Feedback Interview Mode: Hold next turn and display immediate coaching panel
          setActiveFeedback(data.feedback)
          setFeedbackContext({
            question: questionBeingAnswered,
            answer: trimmed,
          })
          setPendingTurnData({
            nextQuestion: data.nextQuestion,
            stage: data.stage || data.interviewState?.currentStageName || null,
            audioUrl: data.audioUrl,
            isComplete: Boolean(data.isComplete),
            demoAccess: data.demoAccess,
            interviewState: data.interviewState,
          })
          setAiTyping(false)
          updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
          return
        }

        if (data.nextQuestion) {
          const aiMsgId = createMessageId('ai')
          const aiMsg = {
            id: aiMsgId,
            sender: 'ai',
            senderName: 'HireMind AI Interviewer',
            time: formatTimer(secondsElapsed + 2),
            stage: data.stage || interviewState?.currentStageName || null,
            text: data.nextQuestion,
          }
          setTranscriptMessages((prev) => [...prev, aiMsg])
          setAiTyping(false)

          if (data.isComplete) {
            if (data.demoAccess && updateDemoQuota) {
              updateDemoQuota(data.demoAccess)
            }
            if (checkInterviewAccessStatus) {
              checkInterviewAccessStatus().catch(() => {})
            }
            setIsCompleted(true)
          }

          // ONLY READ QUESTION ALOUD IF NOT TERMINATED OR COMPLETED
          speakInterviewerMessage(data.nextQuestion, aiMsgId, data.audioUrl)
          return
        }

        if (data.isComplete) {
          if (data.demoAccess && updateDemoQuota) {
            updateDemoQuota(data.demoAccess)
          }
          if (checkInterviewAccessStatus) {
            checkInterviewAccessStatus().catch(() => {})
          }
          setIsCompleted(true)
          updateVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
          setAiTyping(false)
          return
        }
      } else if (res.status === 409) {
        console.warn('[InterviewRoom] Duplicate turn detected, ignoring.')
        setAiTyping(false)
        updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
        return
      } else {
        throw new Error(`Server returned status ${res.status}`)
      }
    } catch (err) {
      if (err.name === 'AbortError' || isTerminatedRef.current) {
        return
      }
      console.warn('[InterviewRoom] Answer processing error:', err)
      setVoiceError({
        code: 'INTERVIEW_AGENT_FAILED',
        message: 'Could not connect to the interview engine. Your answer has been saved; please retry.',
        canRetry: true,
        canSwitchToText: true,
      })
      updateVoiceState(VOICE_STATES.ERROR)
      setAiTyping(false)
    }
  }

  // Continue to the next question from Feedback Coaching Panel
  const handleContinueFromFeedback = () => {
    if (!pendingTurnData) return
    const { nextQuestion, stage, audioUrl, isComplete, demoAccess, interviewState: nextIntState } = pendingTurnData

    setActiveFeedback(null)
    setPendingTurnData(null)
    setFeedbackError(null)

    if (nextIntState) {
      setInterviewState(nextIntState)
    }

    if (isComplete) {
      if (demoAccess && updateDemoQuota) updateDemoQuota(demoAccess)
      if (checkInterviewAccessStatus) checkInterviewAccessStatus().catch(() => {})
      setIsCompleted(true)
      updateVoiceState(VOICE_STATES.INTERVIEW_COMPLETE)
      return
    }

    if (nextQuestion) {
      const aiMsgId = createMessageId('ai')
      const aiMsg = {
        id: aiMsgId,
        sender: 'ai',
        senderName: 'HireMind AI Interviewer',
        time: formatTimer(secondsElapsed + 2),
        stage: stage || interviewState?.currentStageName || null,
        text: nextQuestion,
      }
      setTranscriptMessages((prev) => [...prev, aiMsg])
      setAiTyping(false)

      speakInterviewerMessage(nextQuestion, aiMsgId, audioUrl)
    }
  }

  // Retry Answer Evaluation safely without re-submitting candidate answer
  const handleRetryFeedback = async () => {
    if (!feedbackContext || isRetryingFeedback) return
    setIsRetryingFeedback(true)
    setFeedbackError(null)
    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const res = await fetch(getApiUrl(`/api/interview/${interviewId}/retry-answer-evaluation`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          question: feedbackContext.question,
          answer: feedbackContext.answer,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.feedback) {
        setActiveFeedback(data.feedback)
      } else {
        setFeedbackError(data.message || 'Retry evaluation failed. Please check your connection.')
      }
    } catch (err) {
      setFeedbackError(err.message || 'Network error retrying evaluation.')
    } finally {
      setIsRetryingFeedback(false)
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
    if (speculativeTimerRef.current) {
      clearTimeout(speculativeTimerRef.current)
      speculativeTimerRef.current = null
    }
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

    let secondsRemaining = Math.ceil(SILENCE_AUTO_SEND_MS / 1000)
    setSilenceCountdown(secondsRemaining)

    speculativeTimerRef.current = setTimeout(() => {
      speculativeTimerRef.current = null
      startSpeculativeTranscription()
    }, SPECULATIVE_STT_DELAY_MS)

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
        console.log('[VoiceMode] Silence reached, auto-submitting answer:', textToSend)
        voiceHandlersRef.current.handleCommitCandidateSpeech?.(textToSend)
      }
    }, SILENCE_AUTO_SEND_MS)
  }

  // Send recorded audio to Whisper. Never throws: resolves to '' on any failure.
  const transcribeRecording = async (audioBlob, timeoutMs) => {
    if (!audioBlob || audioBlob.size < 1000) return ''
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const formData = new FormData()
      formData.append('audio', audioBlob, 'candidate_answer.webm')
      const res = await fetch(getApiUrl(`/api/interview/${interviewId}/voice/transcribe`), {
        method: 'POST',
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: formData,
        signal: controller.signal,
      })
      if (!res.ok) return ''
      const data = await res.json()
      return data.success === false ? '' : (data.text || '').trim()
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('[VoiceMode] Whisper transcription notice:', err)
      return ''
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Transcribe what has been recorded so far while the silence countdown runs
  const startSpeculativeTranscription = () => {
    const recorder = mediaRecorderRef.current
    const liveText = (liveTranscriptRef.current || '').trim()
    if (
      voiceStateRef.current !== VOICE_STATES.CANDIDATE_SPEAKING ||
      !recorder ||
      !liveText ||
      recordedChunksRef.current.length === 0
    ) return
    const audioBlob = new Blob(recordedChunksRef.current.slice(), { type: recorder.mimeType || 'audio/webm' })
    speculativeSttRef.current = {
      words: countWords(liveText),
      promise: transcribeRecording(audioBlob, 15000),
    }
  }

  // Stop recognition + recording WITHOUT submitting anything (mute, pause, replay, end)
  const stopCandidateCapture = () => {
    resetSilenceDetection()
    speculativeSttRef.current = null
    listenSessionRef.current += 1
    speechRecognitionOkRef.current = false
    hasSpokenRef.current = false

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    if (recognitionRef.current) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      try {
        recognition.onresult = null
        recognition.onerror = null
        recognition.onend = null
        recognition.abort()
      } catch { /* non-critical; safe to ignore */ }
    }

    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current
      mediaRecorderRef.current = null
      try {
        recorder.ondataavailable = null
        recorder.onstop = null
        if (recorder.state !== 'inactive') recorder.stop()
      } catch { /* non-critical; safe to ignore */ }
    }
  }

  const getRecordingDurationSeconds = () => {
    if (!recordingStartedAtRef.current) return 0
    return Math.max(1, Math.round((monotonicNow() - recordingStartedAtRef.current) / 1000))
  }

  // Finalize speech and commit to transcript / backend
  const handleCommitCandidateSpeech = (explicitText = null) => {
    // Silence timer, volume detector and "Send Now" can race; only the first commit counts
    if (voiceStateRef.current !== VOICE_STATES.CANDIDATE_SPEAKING) return

    const liveText = (explicitText !== null ? explicitText : (liveTranscriptRef.current || '')).trim()
    const durationSeconds = getRecordingDurationSeconds()
    const recorder = mediaRecorderRef.current
    const mimeType = recorder?.mimeType || 'audio/webm'
    const hasRecording = Boolean(recorder && recorder.state !== 'inactive')

    // A background transcription is reusable if the candidate hasn't said more since it started
    const speculative = speculativeSttRef.current
    const speculativeUsable = Boolean(speculative && liveText && countWords(liveText) <= speculative.words + 1)

    if (hasRecording && !speculativeUsable) {
      // Detach the recorder so stopCandidateCapture lets it finish and flush its audio
      mediaRecorderRef.current = null
    }
    stopCandidateCapture()

    if (!hasRecording && !speculativeUsable) {
      finalizeCandidateSpeech(liveText, durationSeconds)
      return
    }

    updateVoiceState(VOICE_STATES.TRANSCRIBING)

    const whisperPromise = speculativeUsable
      ? speculative.promise
      : new Promise((resolve) => {
          recorder.onstop = () => resolve(new Blob(recordedChunksRef.current, { type: mimeType }))
          try {
            recorder.stop()
          } catch {
            resolve(null)
          }
        }).then((audioBlob) => transcribeRecording(audioBlob, liveText ? 8000 : 30000))

    whisperPromise.then((whisperText) => {
      if (isCompletedRef.current || isTerminatedRef.current) return
      if (voiceStateRef.current !== VOICE_STATES.TRANSCRIBING) return
      voiceHandlersRef.current.finalizeCandidateSpeech?.(chooseBestTranscript(liveText, whisperText), durationSeconds)
    })
  }

  // Start continuous listening when candidate's turn begins
  const startVoiceListening = async () => {
    if (
      isVoiceMutedRef.current ||
      isPausedRef.current ||
      isCompletedRef.current ||
      isTerminatedRef.current ||
      isAiTypingRef.current ||
      voiceStateRef.current === VOICE_STATES.AI_PROCESSING ||
      voiceStateRef.current === VOICE_STATES.TRANSCRIBING ||
      voiceStateRef.current === VOICE_STATES.PREPARING_SPEECH
    ) {
      return
    }

    speechQueueRef.current.splice(0)
    stopCurrentAudio()
    stopCandidateCapture()
    setVoiceError(null)
    updateLiveTranscript('')
    committedTranscriptRef.current = ''
    sessionFinalTranscriptRef.current = ''
    lastSpeechAtRef.current = monotonicNow()
    setIsAudioOn(true)
    updateVoiceState(VOICE_STATES.CANDIDATE_SPEAKING)
    const listenSession = listenSessionRef.current

    try {
      const stream = await startMicrophone()
      // Turn changed while we were waiting for microphone permission
      if (listenSession !== listenSessionRef.current || voiceStateRef.current !== VOICE_STATES.CANDIDATE_SPEAKING) {
        return
      }
      stream.getAudioTracks().forEach((t) => {
        t.enabled = true
      })
      setIsAudioOn(true)

      // 1. Web Speech API for real-time live typing directly into the UI
      const SpeechRecognition = typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition()
          recognition.continuous = true
          recognition.interimResults = true
          recognition.lang = getRecognitionLang()
          recognition.maxAlternatives = 1

          recognition.onresult = (event) => {
            if (recognitionRef.current !== recognition || isVoiceMutedRef.current) return
            speechRecognitionOkRef.current = true

            let sessionFinal = ''
            let interim = ''
            for (let i = 0; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                sessionFinal += event.results[i][0].transcript + ' '
              } else {
                interim += event.results[i][0].transcript
              }
            }
            sessionFinalTranscriptRef.current = sessionFinal.trim()
            // Chrome restarts recognition after pauses; keep what was said before the restart
            const combined = [committedTranscriptRef.current, sessionFinal, interim]
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
            if (combined) {
              updateLiveTranscript(combined)
              // Reset and restart the silence auto-send timer
              startSilenceDetection()
            }
          }

          recognition.onerror = (e) => {
            if (recognitionRef.current !== recognition) return
            if (e.error === 'no-speech' || e.error === 'aborted') return
            console.warn('[WebSpeech] Recognition unavailable, using recorded audio instead:', e.error)
            // Fatal (blocked, offline, unsupported): fall back to volume detection + server transcription
            speechRecognitionOkRef.current = false
            recognitionRef.current = null
          }

          recognition.onend = () => {
            if (recognitionRef.current !== recognition) return
            committedTranscriptRef.current = [committedTranscriptRef.current, sessionFinalTranscriptRef.current]
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
            sessionFinalTranscriptRef.current = ''
            // Auto-restart while it is still the candidate's turn
            if (!isVoiceMutedRef.current && voiceStateRef.current === VOICE_STATES.CANDIDATE_SPEAKING) {
              setTimeout(() => {
                if (recognitionRef.current !== recognition) return
                try { recognition.start() } catch { /* already running */ }
              }, 200)
            }
          }

          recognitionRef.current = recognition
          recognition.start()
          speechRecognitionOkRef.current = true
        } catch (recErr) {
          console.warn('[WebSpeech] SpeechRecognition start notice:', recErr)
          speechRecognitionOkRef.current = false
          recognitionRef.current = null
        }
      }

      // 2. MediaRecorder: server-side transcription fallback when live typing captures nothing
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
          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordedChunksRef.current.push(event.data)
            }
          }
          mediaRecorderRef.current = recorder
          recorder.start(250)
        }
      } catch (recorderErr) {
        console.warn('[VoiceMode] MediaRecorder fallback init note:', recorderErr)
      }

      recordingStartedAtRef.current = monotonicNow()
      setRecordingSeconds(0)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('[VoiceMode] Failed to start microphone:', err)
      if (listenSession !== listenSessionRef.current) return
      updateVoiceState(VOICE_STATES.ERROR)

      let errorMessage = 'Microphone permission was denied or microphone hardware is unavailable.'
      let errorDetails = ''

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission is blocked in your browser.'
        errorDetails = 'Click the lock or tune icon in your browser address bar (next to the URL), change Microphone to "Allow", and then click "Try Turning ON Mic Again".'
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

  const unmuteMicrophone = () => {
    setIsVoiceMuted(false)
    isVoiceMutedRef.current = false
    setIsAudioOn(true)
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true
        })
      } catch { /* non-critical; safe to ignore */ }
    }
  }

  // Toggle Mute / Unmute (acts as "Interject" while the interviewer is speaking)
  const handleToggleMute = () => {
    const state = voiceStateRef.current
    if (state === VOICE_STATES.INTERVIEWER_SPEAKING || state === VOICE_STATES.PREPARING_SPEECH) {
      if (isVoiceMutedRef.current) unmuteMicrophone()
      handleCandidateBargeIn()
      return
    }

    if (isVoiceMutedRef.current) {
      unmuteMicrophone()
      startVoiceListening()
      return
    }

    // Muting discards the in-progress capture instead of submitting a half answer
    setIsVoiceMuted(true)
    isVoiceMutedRef.current = true
    stopCandidateCapture()
    updateLiveTranscript('')
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false
        })
      } catch { /* non-critical; safe to ignore */ }
    }
    if (state === VOICE_STATES.CANDIDATE_SPEAKING || state === VOICE_STATES.ERROR) {
      updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
    }
  }

  // Explicit "Start Answering" / retry action
  const handleToggleVoiceMic = (turnOn) => {
    if (turnOn) {
      if (isVoiceMutedRef.current) unmuteMicrophone()
      if (voiceStateRef.current === VOICE_STATES.ERROR) {
        updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      }
      startVoiceListening()
    } else {
      handleCommitCandidateSpeech()
    }
  }

  // Finalize authentic candidate speech and dispatch to AI Interview Agent
  const finalizeCandidateSpeech = (text, durationSeconds = 0) => {
    const trimmed = (text || '').trim()
    if (!trimmed) {
      // Nothing was heard: gently re-open the mic instead of showing an error
      updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      triggerBargeInToast("We didn't catch that — please go ahead and answer again.")
      startVoiceListening()
      return
    }

    updateLiveTranscript('')
    voiceHandlersRef.current.submitCandidateAnswer?.(trimmed, 'voice', durationSeconds)
  }

  // Keep long-lived callbacks pointed at the latest render's handlers
  useEffect(() => {
    voiceHandlersRef.current = {
      startVoiceListening,
      handleCommitCandidateSpeech,
      finalizeCandidateSpeech,
      submitCandidateAnswer,
    }
  })

  // Pause / Resume interview session
  const handleTogglePause = () => {
    if (isCompleted) return

    if (!isPaused) {
      const wasInterviewerTalking =
        voiceStateRef.current === VOICE_STATES.INTERVIEWER_SPEAKING ||
        voiceStateRef.current === VOICE_STATES.PREPARING_SPEECH
      speechQueueRef.current.splice(0)
      stopCurrentAudio()
      stopCandidateCapture()
      isPausedRef.current = true
      setIsPaused(true)
      setIsRecording(false)
      if (wasInterviewerTalking || voiceStateRef.current === VOICE_STATES.CANDIDATE_SPEAKING) {
        updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
      }
    } else {
      isPausedRef.current = false
      setIsPaused(false)
      setIsRecording(true)
      if (interviewModeRef.current === 'voice' && !isVoiceMutedRef.current && !isAiTypingRef.current && !isCompletedRef.current) {
        startVoiceListening()
      }
    }
  }

  // Open modal to safely confirm interview conclusion mid-way or completely
  const handleEndCall = () => {
    // Immediately silence any interviewer voice playback and pause speech recognition
    speechQueueRef.current.splice(0)
    stopCurrentAudio()
    stopCandidateCapture()
    if (voiceStateRef.current === VOICE_STATES.CANDIDATE_SPEAKING || voiceStateRef.current === VOICE_STATES.INTERVIEWER_SPEAKING) {
      updateVoiceState(VOICE_STATES.WAITING_FOR_CANDIDATE)
    }
    setIsEndModalOpen(true)
  }

  // Cancel conclusion modal and resume listening if voice mode active
  const handleCancelEndModal = () => {
    setIsEndModalOpen(false)
    if (interviewModeRef.current === 'voice' && !isVoiceMutedRef.current) {
      startVoiceListening()
    }
  }

  // Execute interview conclusion and transition to evaluation report
  const handleConfirmEndInterview = async () => {
    // 1. Mark as permanently terminated immediately
    isTerminatedRef.current = true
    setIsCompleted(true)
    setIsEnding(true)

    // 2. Kill all active voice, speech synthesis, and audio buffers
    stopCurrentAudio()
    stopCandidateCapture()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel() } catch { /* non-critical; safe to ignore */ }
    }

    // 3. Abort in-flight network requests (AI turns, speech synth, code executions)
    if (inFlightAbortControllerRef.current) {
      try { inFlightAbortControllerRef.current.abort() } catch { /* non-critical; safe to ignore */ }
      inFlightAbortControllerRef.current = new AbortController()
    }

    // 4. Abort speech recognition immediately and detach listeners
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        recognitionRef.current.abort()
      } catch { /* non-critical; safe to ignore */ }
      recognitionRef.current = null
    }

    // 5. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.ondataavailable = null
        mediaRecorderRef.current.onstop = null
        mediaRecorderRef.current.stop()
      } catch { /* non-critical; safe to ignore */ }
      mediaRecorderRef.current = null
    }

    // 6. Stop all hardware audio & video tracks (mic and camera)
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      } catch { /* non-critical; safe to ignore */ }
      mediaStreamRef.current = null
    }

    // 7. Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close().catch(() => {}) } catch { /* non-critical; safe to ignore */ }
      audioContextRef.current = null
    }

    // 8. Clear all silence timers and elapsed intervals
    resetSilenceDetection()
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    // 9. Resolve authoritative target session ID
    const targetSessionId = session?.sessionId || session?.id || interviewId
    if (targetSessionId && targetSessionId !== 'default') {
      localStorage.setItem('hiremind_last_interview_id', targetSessionId)
      saveInterviewSession({
        id: targetSessionId,
        sessionId: targetSessionId,
        status: 'ended_by_user',
        isEndedByUser: true,
        lastVisitedPath: `/interview-report?id=${targetSessionId}`,
      })
    }

    // 10. Call backend to mark interview as concluded
    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      const endRes = await fetch(getApiUrl(`/api/interview/${targetSessionId}/end`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
      })
      if (endRes.ok) {
        const endData = await endRes.json()
        if (endData.sessionId) {
          localStorage.setItem('hiremind_last_interview_id', endData.sessionId)
        }
        if (endData.demoAccess && updateDemoQuota) {
          updateDemoQuota(endData.demoAccess)
        }
      }
      if (checkInterviewAccessStatus) {
        await checkInterviewAccessStatus().catch(() => {})
      }
    } catch (e) {
      console.warn('Manual end call network notice:', e)
    }

    // 11. Final voice kill before navigation
    stopCurrentAudio()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel() } catch { /* non-critical; safe to ignore */ }
    }

    setIsEnding(false)
    setIsEndModalOpen(false)
    navigate(`/interview-report?id=${targetSessionId}`, { replace: true })
  }

  // Cleanup on unmount only (declared after the refs and helpers it uses)
  useEffect(() => {
    return () => {
      isTerminatedRef.current = true
      stopCurrentAudio()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel() } catch { /* non-critical; safe to ignore */ }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null
          recognitionRef.current.onerror = null
          recognitionRef.current.onend = null
          recognitionRef.current.abort()
        } catch { /* non-critical; safe to ignore */ }
        recognitionRef.current = null
      }
      if (inFlightAbortControllerRef.current) {
        try { inFlightAbortControllerRef.current.abort() } catch { /* non-critical; safe to ignore */ }
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        } catch { /* non-critical; safe to ignore */ }
      }
      resetSilenceDetection()
    }
  }, [])

  // Derive dynamic session information
  const candidateTurns = transcriptMessages.filter((m) => m.sender === 'candidate').length
  const stages = session?.interviewPlan?.stages || session?.userFacingPlan?.stages || []
  const currentStageIndex = typeof interviewState?.currentStageIndex === 'number'
    ? interviewState.currentStageIndex
    : (typeof session?.interviewState?.currentStageIndex === 'number'
        ? session.interviewState.currentStageIndex
        : Math.min(candidateTurns, Math.max(0, stages.length - 1)))
  const currentStage = stages[currentStageIndex] || null
  const currentStageNumber = currentStageIndex + 1
  const totalStages = stages.length || 7

  const isCodingStage = Boolean(
    currentStage?.id === 'stage_coding' ||
    currentStage?.name?.toLowerCase().includes('coding') ||
    currentStage?.name?.toLowerCase().includes('problem solving') ||
    currentStage?.topics?.some((t) =>
      typeof t === 'string' && (
        t.toLowerCase().includes('coding') ||
        t.toLowerCase().includes('algorithm') ||
        t.toLowerCase().includes('data structure')
      )
    )
  )

  // Auto-open Code Studio when first entering the Coding stage
  useEffect(() => {
    if (isCodingStage && !hasAutoOpenedCodeRef.current) {
      hasAutoOpenedCodeRef.current = true
      setIsCodeStudioOpen(true)
    }
  }, [isCodingStage])

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
          {/* Audio & Hardware Green Room Check Button (Feature 1B) */}
          <button
            type="button"
            className="int-room-nav__hw-btn"
            onClick={() => {
              setIsHardwareModalOpen(true)
              startMicrophone().catch(() => {})
            }}
            title="Microphone & Speaker Hardware Quality Check"
            aria-label="Hardware Audio Check"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <span>Audio Check</span>
          </button>

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
        {isCodeStudioOpen && (
          <button
            type="button"
            className={`int-room-mobile-tab ${activeMobileTab === 'code' ? 'is-active' : ''}`}
            onClick={() => setActiveMobileTab('code')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: '-1px' }}>
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Code IDE
          </button>
        )}
      </div>

      {/* =====================================================================
          MAIN COCKPIT WORKSPACE (Left Context + Center AI Chat + Monaco Code Studio)
          ===================================================================== */}
      <div className={`int-room-workspace ${isCodeStudioOpen ? 'has-code-studio' : ''}`}>
        {/* ===================================================================
            COLUMN 1: Left Context & Question Progress Card
            =================================================================== */}
        <section
          className={`int-room-col int-room-col--left ${
            activeMobileTab === 'context' ? 'is-mobile-visible' : 'is-mobile-hidden'
          }`}
        >
          {/* Top-Left Session Timer & Controls */}
          <div className="int-room-ctrl-row">
            <div className={`int-room-rec-pill ${isRecording && !isPaused ? 'is-recording' : 'is-paused'}`}>
              <span className="int-room-rec-dot-wrap">
                <img src={recordingDotIcon} alt="REC" className="int-room-rec-dot" />
              </span>
              <span className="int-room-rec-label">{isPaused ? 'PAUSED' : 'REC'}</span>
              <span className="int-room-rec-time">{formatTimer(secondsElapsed)}</span>
            </div>

            {/* Pause / Resume Button */}
            <button
              type="button"
              className={`int-room-pause-btn ${isPaused ? 'is-active-paused' : ''}`}
              onClick={handleTogglePause}
              title={isPaused ? 'Resume Interview' : 'Pause Interview'}
              aria-label={isPaused ? 'Resume Interview' : 'Pause Interview'}
            >
              <span className="int-room-pause-icon">{isPaused ? '▶' : '⏸'}</span>
              <span className="int-room-pause-label">{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

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

            {/* FEATURE 2B: ENHANCED STAGE AGENDA COVERAGE MATRIX */}
            {stages.length > 0 && (
              <div className="int-room-agenda-matrix">
                <div className="int-room-agenda-header">
                  <span className="int-room-agenda-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    STAGE AGENDA COVERAGE
                  </span>
                  <span className="int-room-agenda-counter">
                    {currentStageIndex + 1}/{totalStages} ({Math.min(100, Math.round(((currentStageIndex + 1) / Math.max(1, totalStages)) * 100))}%)
                  </span>
                </div>

                <div className="int-room-agenda-progress-track">
                  <div
                    className="int-room-agenda-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.round(((currentStageIndex + (interviewState?.currentStageHops || 0) * 0.4) / Math.max(1, totalStages)) * 100))}%`,
                    }}
                  />
                </div>

                <div className="int-room-agenda-list">
                  {stages.map((stg, idx) => {
                    const isPast = idx < currentStageIndex
                    const isCurrent = idx === currentStageIndex
                    const hops = isCurrent ? (interviewState?.currentStageHops || 1) : (isPast ? 2 : 0)
                    return (
                      <div
                        key={stg.id || idx}
                        className={`int-room-agenda-item ${isPast ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''}`}
                      >
                        <div className="int-room-agenda-row">
                          <div className="int-room-agenda-row-left">
                            <div className={`int-room-agenda-step-dot ${isPast ? 'is-completed' : isCurrent ? 'is-current' : 'is-upcoming'}`}>
                              {isPast ? '✓' : idx + 1}
                            </div>
                            <span className="int-room-agenda-name">{stg.name || stg.title || `Stage ${idx + 1}`}</span>
                          </div>
                          <div>
                            {isPast ? (
                              <span className="int-room-agenda-hop-pill is-done">✓ Covered</span>
                            ) : isCurrent ? (
                              <span className="int-room-agenda-hop-pill" title="Follow-up questioning depth (max 2 hops per stage)">
                                Hop {Math.min(2, hops)} of 2
                              </span>
                            ) : (
                              <span style={{ fontSize: '10.5px', color: '#64748b' }}>Planned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
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
                {/* Active Interview Mode Badge */}
                <div
                  className={`int-room-mode-pill ${session?.interviewMode === 'FEEDBACK_COACHING' ? 'int-room-mode-pill--feedback' : 'int-room-mode-pill--hr'}`}
                  title={
                    session?.interviewMode === 'FEEDBACK_COACHING'
                      ? 'Feedback Interview Mode: Immediate Coaching & Answer Evaluation'
                      : 'HR Interview Mode: Realistic Simulation Without Immediate Interruptions'
                  }
                >
                  <span className={`int-room-mode-dot ${session?.interviewMode === 'FEEDBACK_COACHING' ? 'is-purple' : 'is-cyan'}`} />
                  <span>
                    {session?.interviewMode === 'FEEDBACK_COACHING'
                      ? 'Feedback Interview Mode'
                      : 'HR Interview Mode'}
                  </span>
                </div>

                {/* Active Stage Indicator */}
                {currentStage && (
                  <div className="int-room-stage-pill">
                    <span className="int-room-stage-pill-num">Stage {currentStageNumber}</span>
                    <span className="int-room-stage-pill-title">{currentStage.name || currentStage.title}</span>
                  </div>
                )}

                {/* Code Studio IDE Toggle Button */}
                <button
                  type="button"
                  className={`int-room-code-toggle-btn ${isCodeStudioOpen ? 'is-active' : ''} ${isCodingStage ? 'is-highlighted' : ''}`}
                  onClick={() => setIsCodeStudioOpen((prev) => !prev)}
                  title={isCodeStudioOpen ? 'Close Code Studio' : 'Open in-browser Code IDE'}
                  aria-label="Toggle Code Editor"
                >
                  <span className="int-room-code-btn-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  </span>
                  <span>{isCodeStudioOpen ? 'Close IDE' : 'Code IDE'}</span>
                  {isCodingStage && <span className="int-room-code-live-pill">Coding Task</span>}
                </button>

                {/* Stage Pause / Resume Button */}
                <button
                  type="button"
                  className={`int-room-stage-pause-btn ${isPaused ? 'is-paused' : ''}`}
                  onClick={handleTogglePause}
                  title={isPaused ? 'Resume Interview' : 'Pause Interview'}
                  aria-label="Pause or Resume Interview"
                >
                  <span>{isPaused ? '▶ Resume' : '⏸ Pause'}</span>
                </button>

                {/* Stage Stop / End Interview Button */}
                <button
                  type="button"
                  className="int-room-stage-end-btn"
                  onClick={handleEndCall}
                  title="Stop Interview & View Evaluation"
                  aria-label="Stop Interview"
                >
                  <span>Stop Interview</span>
                </button>

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
                {/* Candidate Barge-in Floating Alert Toast (Feature 2A) */}
                {bargeInToast && (
                  <div className="int-room-bargein-toast" role="alert">
                    <span className="int-room-bargein-toast-dot" />
                    <span>{bargeInToast}</span>
                  </div>
                )}

                <div className="int-room-voice-status-bar">
                  {voiceState === VOICE_STATES.INITIALIZING && (
                    <span className="int-room-voice-badge is-thinking">
                      <span className="int-room-pulse-dot is-yellow" />
                      Your interviewer is joining the room...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.PREPARING_SPEECH && (
                    <span className="int-room-voice-badge is-thinking">
                      <span className="int-room-pulse-dot is-cyan" />
                      Interviewer is about to speak...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.INTERVIEWER_SPEAKING && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="int-room-voice-badge is-speaking">
                        <span className="int-room-pulse-dot is-cyan" />
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        AI Interviewer Speaking... (Please Listen)
                      </span>
                      {/* Feature 2A: On-Screen Candidate Barge-In Button */}
                      <button
                        type="button"
                        className="int-room-bargein-pill-btn"
                        onClick={() => handleCandidateBargeIn()}
                        title="Interrupt the AI interviewer and speak immediately"
                      >
                        <span>✋</span>
                        <span>Excuse Me / Interject</span>
                      </button>
                    </div>
                  )}
                  {voiceState === VOICE_STATES.WAITING_FOR_CANDIDATE && (
                    <span className="int-room-voice-badge is-waiting">
                      <span className="int-room-pulse-dot is-green" />
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                      {isVoiceMuted ? 'Your turn — unmute your microphone to answer' : 'Your turn — press "Start Answering" below'}
                    </span>
                  )}
                  {voiceState === VOICE_STATES.CANDIDATE_SPEAKING && (
                    <span className="int-room-voice-badge is-recording">
                      <span className="int-room-pulse-dot is-red" />
                      Microphone ON • Speech typing live...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.TRANSCRIBING && (
                    <span className="int-room-voice-badge is-transcribing">
                      <span className="int-room-pulse-dot is-purple" />
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Finalizing speech transcription...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.AI_PROCESSING && (
                    <span className="int-room-voice-badge is-thinking">
                      <span className="int-room-pulse-dot is-yellow" />
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
                        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
                      </svg>
                      HireMind AI thinking...
                    </span>
                  )}
                  {voiceState === VOICE_STATES.ERROR && (
                    <span className="int-room-voice-badge is-error">
                      <span className="int-room-pulse-dot is-red" />
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px', verticalAlign: '-1px' }}>
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Attention Needed
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
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 21h5v-5" />
                          </svg>
                          {voiceError.code === 'MICROPHONE_PERMISSION_DENIED' ? 'Try Turning ON Mic Again' : 'Answer Again'}
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
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          Type Answer Instead
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stage Messages Scroll Area */}
            <div className="int-room-stage-messages">
              {/* Interactive Coding Task Banner */}
              {isCodingStage && !isCodeStudioOpen && !isCompleted && (
                <div className="int-room-coding-alert-banner">
                  <div className="int-room-coding-alert-left">
                    <span className="int-room-coding-alert-pulse">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </span>
                    <div className="int-room-coding-alert-info">
                      <strong>Interactive Coding Challenge Active</strong>
                      <span>Solve the problem, test with custom inputs, and submit to the AI interviewer.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="int-room-coding-alert-open-btn"
                    onClick={() => setIsCodeStudioOpen(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                    Open In-Browser IDE
                  </button>
                </div>
              )}

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

                    {msg.isCode ? (
                      <div className="int-room-chat-msg__bubble is-code-bubble">
                        <div className="int-room-code-bubble-top">
                          <span className="int-room-code-bubble-lang">{msg.codeLanguage?.toUpperCase() || 'CODE'}</span>
                          <span className="int-room-code-bubble-badge">Submitted Solution</span>
                        </div>
                        {msg.explanation && (
                          <p className="int-room-code-bubble-note">{msg.explanation}</p>
                        )}
                        <pre className="int-room-code-bubble-pre">
                          <code>{msg.codeSnippet}</code>
                        </pre>
                        {msg.codeOutput && (
                          <div className="int-room-code-bubble-output">
                            <span className="int-room-code-bubble-out-title">Terminal Output:</span>
                            <pre>{msg.codeOutput}</pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`int-room-chat-msg__bubble ${msg.isFeedback ? 'is-feedback-bubble' : ''}`}>
                        {msg.isFeedback && (
                          <span className="int-room-feedback-inline-label">Coaching feedback</span>
                        )}
                        <p className="int-room-chat-msg__text">{msg.text}</p>
                        {/* Inline Audio Replay Button for AI Questions */}
                        {msg.sender === 'ai' && (
                          <button
                            type="button"
                            className={`int-room-inline-play-btn ${playingMessageId === msg.id ? 'is-playing' : ''}`}
                            onClick={() => handleSynthesizeSpeech(msg.text, msg.id)}
                            title={playingMessageId === msg.id ? 'Playing audio...' : 'Play question audio'}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              {playingMessageId === msg.id ? (
                                <>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                  </svg>
                                  Playing...
                                </>
                              ) : (
                                <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                  </svg>
                                  Listen
                                </>
                              )}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Real-time candidate speech typing automatically into UI */}
              {(voiceState === VOICE_STATES.CANDIDATE_SPEAKING || (voiceState === VOICE_STATES.TRANSCRIBING && liveTranscript)) && (
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
                      {voiceState === VOICE_STATES.TRANSCRIBING ? (
                        <span className="int-room-live-speaking-badge">
                          <span className="int-room-live-speaking-dot" /> Finalizing...
                        </span>
                      ) : silenceCountdown > 0 ? (
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

              {interviewMode === 'voice' && voiceState === VOICE_STATES.INITIALIZING && transcriptMessages.length === 0 && (
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
                      <span className="int-room-typing-label">Your interviewer is reviewing your profile and will greet you shortly...</span>
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
                    {(voiceState === VOICE_STATES.INITIALIZING || voiceState === VOICE_STATES.PREPARING_SPEECH) && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span className="int-room-pulse-dot is-yellow" style={{ display: 'inline-block', width: '8px', height: '8px' }} />
                        {voiceState === VOICE_STATES.INITIALIZING
                          ? 'Setting up your interview. Please allow microphone access if your browser asks.'
                          : 'Preparing the interviewer\'s voice...'}
                      </span>
                    )}
                    {voiceState === VOICE_STATES.INTERVIEWER_SPEAKING && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        AI Interviewer is speaking... Please listen to the question.
                      </span>
                    )}
                    {voiceState === VOICE_STATES.AI_PROCESSING && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
                          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
                        </svg>
                        AI is processing your answer and formulating the next question...
                      </span>
                    )}
                    {voiceState === VOICE_STATES.TRANSCRIBING && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        Polishing your transcript for accuracy...
                      </span>
                    )}
                    {voiceState === VOICE_STATES.ERROR && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Something needs your attention. See the message above to continue.
                      </span>
                    )}
                    {isVoiceMuted && voiceState !== VOICE_STATES.INTERVIEWER_SPEAKING && voiceState !== VOICE_STATES.AI_PROCESSING && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="2" y1="2" x2="22" y2="22" />
                          <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                          <path d="M5 10v2a7 7 0 0 0 12 5" />
                        </svg>
                        Microphone is MUTED. Click Unmute when you are ready to speak your answer.
                      </span>
                    )}
                    {!isVoiceMuted && voiceState === VOICE_STATES.CANDIDATE_SPEAKING && silenceCountdown > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Silence detected. Auto-sending your answer in <strong>{silenceCountdown}s</strong>...
                      </span>
                    )}
                    {!isVoiceMuted && voiceState === VOICE_STATES.CANDIDATE_SPEAKING && silenceCountdown === 0 && liveTranscript && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span className="int-room-pulse-dot is-red" style={{ display: 'inline-block', width: '8px', height: '8px' }} />
                        Microphone is LIVE. Speaking... (sends automatically when you pause)
                      </span>
                    )}
                    {!isVoiceMuted && voiceState === VOICE_STATES.WAITING_FOR_CANDIDATE && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span className="int-room-pulse-dot is-green" style={{ display: 'inline-block', width: '8px', height: '8px' }} />
                        Your turn. Press <strong>Start Answering</strong> when you are ready, or replay the question.
                      </span>
                    )}
                    {!isVoiceMuted && voiceState === VOICE_STATES.CANDIDATE_SPEAKING && !liveTranscript && silenceCountdown === 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                        Microphone is LIVE and listening. Speak your answer now — press <strong>Done</strong> when you finish.
                      </span>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {isVoiceMuted ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                          </svg>
                          Unmute Microphone
                        </>
                      ) : voiceState === VOICE_STATES.INTERVIEWER_SPEAKING ? (
                        <>
                          <span style={{ fontSize: '13px' }}>✋</span>
                          Excuse Me / Interject & Answer
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="2" y1="2" x2="22" y2="22" />
                            <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                            <path d="M5 10v2a7 7 0 0 0 12 5" />
                            <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                          </svg>
                          Mute Microphone
                        </>
                      )}
                    </span>
                  </button>

                  {/* Start Answering: opens the mic when it's the candidate's turn */}
                  {!isVoiceMuted && voiceState === VOICE_STATES.WAITING_FOR_CANDIDATE && !isAiTyping && (
                    <button
                      type="button"
                      className="int-room-voice-dock__send-btn"
                      onClick={() => handleToggleVoiceMic(true)}
                      title="Open your microphone and start answering"
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        </svg>
                        Start Answering
                      </span>
                    </button>
                  )}

                  {/* Done / Send Now: always available while answering (works even if live typing captured nothing) */}
                  {voiceState === VOICE_STATES.CANDIDATE_SPEAKING && (liveTranscript.trim().length > 0 || recordingSeconds >= 2) && (
                    <button
                      type="button"
                      className="int-room-voice-dock__send-btn"
                      onClick={() => handleCommitCandidateSpeech()}
                      title="Send answer immediately without waiting for 3s silence"
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        {liveTranscript.trim() ? 'Send Now' : 'Done Answering'} {silenceCountdown > 0 ? `(${silenceCountdown}s)` : ''}
                      </span>
                    </button>
                  )}

                  {/* Replay Question Button */}
                  {latestAiQuestion && (
                    <button
                      type="button"
                      className="int-room-voice-dock__replay-btn"
                      onClick={() => handleSynthesizeSpeech(latestAiQuestion.text, latestAiQuestion.id)}
                      disabled={
                        voiceState === VOICE_STATES.INTERVIEWER_SPEAKING ||
                        voiceState === VOICE_STATES.PREPARING_SPEECH ||
                        voiceState === VOICE_STATES.AI_PROCESSING ||
                        voiceState === VOICE_STATES.TRANSCRIBING ||
                        isAiTyping
                      }
                      title="Replay interviewer's question aloud"
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        Replay Question
                      </span>
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

        {/* ===================================================================
            COLUMN 3: In-Browser Interactive Code Studio (Monaco Editor & Sandbox)
            =================================================================== */}
        {isCodeStudioOpen && (
          <section
            className={`int-room-col int-room-col--code ${
              activeMobileTab === 'code' ? 'is-mobile-visible' : ''
            }`}
          >
            <div className="int-room-code-card">
              {/* Code Studio Header */}
              <div className="int-room-code-header">
                <div className="int-room-code-header-left">
                  <span className="int-room-code-title-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  </span>
                  <div>
                    <div className="int-room-code-title">HireMind Code Studio</div>
                    <div className="int-room-code-subtitle">In-Browser Sandbox • Judge0 CE Powered</div>
                  </div>
                </div>

                <div className="int-room-code-header-right">
                  {/* Language Selector */}
                  <select
                    className="int-room-code-lang-select"
                    value={codeLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    aria-label="Programming Language"
                  >
                    <option value="javascript">JavaScript (Node.js)</option>
                    <option value="python">Python 3</option>
                    <option value="typescript">TypeScript</option>
                    <option value="java">Java (OpenJDK)</option>
                    <option value="cpp">C++ (GCC)</option>
                  </select>

                  {/* Reset Template */}
                  <button
                    type="button"
                    className="int-room-code-ctrl-btn"
                    onClick={() => {
                      if (window.confirm('Reset code to starter boilerplate?')) {
                        setCodeContent(CODE_STARTERS[codeLanguage] || '')
                      }
                    }}
                    title="Reset code to starter boilerplate"
                  >
                    ↺ Reset
                  </button>

                  {/* Close Panel */}
                  <button
                    type="button"
                    className="int-room-code-ctrl-btn is-close"
                    onClick={() => setIsCodeStudioOpen(false)}
                    title="Close Code Studio"
                    aria-label="Close Code Studio"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Monaco Editor Container */}
              <div className="int-room-monaco-wrap">
                <Editor
                  height="100%"
                  language={codeLanguage === 'cpp' ? 'cpp' : codeLanguage}
                  theme="vs-dark"
                  value={codeContent}
                  onChange={(val) => setCodeContent(val || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    roundedSelection: true,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    padding: { top: 10, bottom: 10 },
                  }}
                />
              </div>

              {/* STDIN Collapsible Area */}
              {isStdinOpen && (
                <div className="int-room-stdin-drawer">
                  <div className="int-room-stdin-title">Custom Input (STDIN):</div>
                  <textarea
                    className="int-room-stdin-input"
                    rows="2"
                    placeholder="Enter custom input / test parameters here..."
                    value={codeStdin}
                    onChange={(e) => setCodeStdin(e.target.value)}
                  />
                </div>
              )}

              {/* Execution & Submission Controls */}
              <div className="int-room-code-actions">
                <div className="int-room-code-actions-left">
                  {/* Run Code Button */}
                  <button
                    type="button"
                    className="int-room-run-code-btn"
                    onClick={handleRunCode}
                    disabled={isCodeRunning || !codeContent.trim()}
                  >
                    {isCodeRunning ? (
                      <>
                        <span className="int-room-spinner" />
                        <span>Running...</span>
                      </>
                    ) : (
                      <>
                        <span>▶ Run Code</span>
                      </>
                    )}
                  </button>

                  {/* Toggle STDIN */}
                  <button
                    type="button"
                    className={`int-room-stdin-toggle-btn ${isStdinOpen ? 'is-open' : ''}`}
                    onClick={() => setIsStdinOpen((prev) => !prev)}
                  >
                    STDIN {isStdinOpen ? '▲' : '▼'}
                  </button>
                </div>

                <div className="int-room-code-actions-right">
                  {/* Submit Solution to AI */}
                  <button
                    type="button"
                    className="int-room-submit-code-btn"
                    onClick={handleSubmitCodeSolution}
                    disabled={isCodeSubmitting || isAiTyping || !codeContent.trim() || isCompleted}
                    title="Submit your code to the AI interviewer for review and scoring"
                  >
                    {isCodeSubmitting ? (
                      <>
                        <span className="int-room-spinner" />
                        <span>Submitting to AI...</span>
                      </>
                    ) : (
                      <>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                          Submit Solution to AI
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Optional explanation / Big-O complexity */}
              <div className="int-room-code-exp-row">
                <input
                  type="text"
                  className="int-room-code-exp-input"
                  placeholder="Optional: Explain your approach or Big-O complexity (e.g. O(N) time, O(1) space)..."
                  value={codeExplanation}
                  onChange={(e) => setCodeExplanation(e.target.value)}
                  disabled={isCodeSubmitting || isCompleted}
                />
              </div>

              {/* Terminal / Output Console */}
              <div className="int-room-code-terminal">
                <div className="int-room-terminal-header">
                  <div className="int-room-terminal-title">
                    <span className="int-room-term-dot" />
                    <span>Terminal Output</span>
                  </div>
                  {codeOutput && (
                    <div className="int-room-terminal-meta">
                      <span className={`int-room-term-status ${codeOutput.success ? 'is-success' : 'is-error'}`}>
                        {codeOutput.status || (codeOutput.success ? 'Success' : 'Failed')}
                      </span>
                      {codeOutput.time && (
                        <span className="int-room-term-metric" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {codeOutput.time}s
                        </span>
                      )}
                      {codeOutput.memory && (
                        <span className="int-room-term-metric" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                            <path d="M7 7h10v10H7z" />
                          </svg>
                          {codeOutput.memory} KB
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="int-room-terminal-body">
                  {isCodeRunning ? (
                    <div className="int-room-term-placeholder is-running">
                      <span className="int-room-spinner" /> Executing in isolated Judge0 sandbox...
                    </div>
                  ) : codeOutput ? (
                    <div className="int-room-term-results">
                      {codeOutput.stdout && (
                        <pre className="int-room-term-stdout">{codeOutput.stdout}</pre>
                      )}
                      {codeOutput.compile_output && (
                        <pre className="int-room-term-compile-err">{codeOutput.compile_output}</pre>
                      )}
                      {codeOutput.stderr && (
                        <pre className="int-room-term-stderr">{codeOutput.stderr}</pre>
                      )}
                      {!codeOutput.stdout && !codeOutput.stderr && !codeOutput.compile_output && (
                        <div className="int-room-term-placeholder">Process finished with no output.</div>
                      )}
                    </div>
                  ) : (
                    <div className="int-room-term-placeholder">
                      Click &quot;▶ Run Code&quot; to test your solution in the cloud sandbox.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* =====================================================================
          INTERVIEW MODE & FORMAT SELECTION MODAL (Prompted at begin of interview)
          ===================================================================== */}
      {isModeModalOpen && (
        <div className="int-room-mode-overlay" role="dialog" aria-modal="true" aria-labelledby="mode-modal-title">
          <div className="int-room-mode-modal">
            {modalStep === 'mode' ? (
              <>
                <div className="int-room-mode-header">
                  <div className="int-room-mode-badge">Step 1 of 2 • Interview Style</div>
                  <h2 id="mode-modal-title" className="int-room-mode-title">Select Interview Mode</h2>
                  <p className="int-room-mode-subtitle">
                    Choose how you would like to experience your interview for the <strong>{displayRole}</strong> position at <strong>{displayCompany}</strong>.
                  </p>
                </div>

                <div className="int-room-mode-grid">
                  {/* Card 1: HR Interview Mode */}
                  <div
                    className={`int-room-mode-card is-hr ${chosenMode === 'HR_SIMULATION' ? 'is-selected' : ''}`}
                    onClick={() => handleChooseInterviewMode('HR_SIMULATION')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleChooseInterviewMode('HR_SIMULATION')
                      }
                    }}
                  >
                    <div className="int-room-mode-card__top">
                      <div className="int-room-mode-card__icon-box">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <span className="int-room-mode-card__badge-pill">Realistic Simulation</span>
                    </div>

                    <h3 className="int-room-mode-card__title">HR Interview Mode</h3>
                    <p className="int-room-mode-card__desc">
                      Experience a realistic interview with an AI interviewer. Answer HR, behavioral, and job-related questions while the AI asks relevant adaptive follow-up questions based on your responses.
                    </p>

                    <ul className="int-room-mode-card__features">
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Realistic interview conversation</span>
                      </li>
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Adaptive follow-up questions</span>
                      </li>
                      <li>
                        <span className="int-room-mode-check is-amber">✓</span>
                        <span>No immediate feedback, scores, or coaching after individual answers</span>
                      </li>
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Comprehensive performance report after the interview ends</span>
                      </li>
                    </ul>

                    <button
                      type="button"
                      className="int-room-mode-card__action-btn is-hr"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleChooseInterviewMode('HR_SIMULATION')
                      }}
                    >
                      Choose HR Mode →
                    </button>
                  </div>

                  {/* Card 2: Feedback Interview Mode */}
                  <div
                    className={`int-room-mode-card is-feedback ${chosenMode === 'FEEDBACK_COACHING' ? 'is-selected is-selected--feedback' : ''}`}
                    onClick={() => handleChooseInterviewMode('FEEDBACK_COACHING')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleChooseInterviewMode('FEEDBACK_COACHING')
                      }
                    }}
                  >
                    <div className="int-room-mode-card__top">
                      <div className="int-room-mode-card__icon-box is-feedback">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          <path d="M12 7v2" />
                          <path d="M12 13h.01" />
                        </svg>
                      </div>
                      <span className="int-room-mode-card__badge-pill is-purple">Interactive Coaching</span>
                    </div>

                    <h3 className="int-room-mode-card__title">Feedback Interview Mode</h3>
                    <p className="int-room-mode-card__desc">
                      Practise answering interview questions while receiving personalized AI feedback after every response. Learn from your mistakes, improve your answers, and continue practising with adaptive follow-up questions.
                    </p>

                    <ul className="int-room-mode-card__features">
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Personalized interview questions</span>
                      </li>
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Immediate feedback after every answer</span>
                      </li>
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Strengths and weaknesses identification</span>
                      </li>
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Actionable suggestions for improving each answer</span>
                      </li>
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Adaptive follow-up questions</span>
                      </li>
                      <li>
                        <span className="int-room-mode-check">✓</span>
                        <span>Comprehensive final performance report</span>
                      </li>
                    </ul>

                    <button
                      type="button"
                      className="int-room-mode-card__action-btn is-feedback"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleChooseInterviewMode('FEEDBACK_COACHING')
                      }}
                    >
                      Choose Feedback Mode →
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="int-room-mode-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      className="int-room-mode-back-btn"
                      onClick={() => setModalStep('mode')}
                      title="Change interview mode"
                    >
                      ← Back to Mode Selection
                    </button>
                    <div className={`int-room-mode-badge ${chosenMode === 'FEEDBACK_COACHING' ? 'is-purple' : ''}`}>
                      {chosenMode === 'FEEDBACK_COACHING' ? '🟣 Feedback Interview Mode' : '🔵 HR Interview Mode'}
                    </div>
                  </div>
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
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                    </div>
                    <h3 className="int-room-mode-card__title">Voice-Based Interview</h3>
                    <p className="int-room-mode-card__desc">
                      The AI interviewer asks questions aloud automatically. You answer naturally using your microphone, with live speech transcription typed directly on screen.
                    </p>
                    <ul className="int-room-mode-card__features">
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        AI automatically reads questions aloud
                      </li>
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Real-time speech typing — words appear as you speak
                      </li>
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Simple microphone ON / OFF controls (no chatbox needed)
                      </li>
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Realistic, immersive conversational practice
                      </li>
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
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <h3 className="int-room-mode-card__title">Text-Based Interview</h3>
                    <p className="int-room-mode-card__desc">
                      Traditional format with on-screen reading and keyboard input. Type your responses and insert code snippets at your own pace.
                    </p>
                    <ul className="int-room-mode-card__features">
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Read questions on screen
                      </li>
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Type responses using the keyboard chatbox
                      </li>
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Insert formatted code snippets
                      </li>
                      <li>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: '8px' }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Self-paced response writing
                      </li>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          FEATURE 1B: PRE-FLIGHT HARDWARE QUALITY CHECK ("GREEN ROOM") MODAL
          ===================================================================== */}
      {isHardwareModalOpen && (
        <div className="int-room-hw-overlay" role="dialog" aria-modal="true" aria-labelledby="hw-modal-title">
          <div className="int-room-hw-modal">
            {/* Header */}
            <div className="int-room-hw-header">
              <div className="int-room-hw-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                PRE-FLIGHT HARDWARE CHECK • GREEN ROOM
              </div>
              <h2 id="hw-modal-title" className="int-room-hw-title">Audio & Microphone Quality Verification</h2>
              <p className="int-room-hw-subtitle">
                Ensure your microphone clarity, volume levels, and audio output are optimal before speaking with the AI interviewer for the <strong>{displayRole}</strong> position.
              </p>
            </div>

            {/* Body */}
            <div className="int-room-hw-body">
              <div className="int-room-hw-grid">
                {/* 1. Microphone Input & Level Test */}
                <div className="int-room-hw-card">
                  <div className="int-room-hw-card-header">
                    <span className="int-room-hw-card-title">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                      Microphone Input
                    </span>
                    <span className={`int-room-hw-status-pill ${micPermissionStatus === 'granted' || isAudioOn ? 'is-ok' : micPermissionStatus === 'denied' ? 'is-error' : 'is-warn'}`}>
                      {micPermissionStatus === 'granted' || isAudioOn ? '● Live & Connected' : micPermissionStatus === 'denied' ? 'Blocked' : 'Testing'}
                    </span>
                  </div>

                  <p className="int-room-hw-card-desc">
                    Speak into your microphone. Watch the live volume indicator below to ensure sufficient input gain.
                  </p>

                  {/* Live Volume Meter Bar */}
                  <div className="int-room-hw-meter-wrap">
                    <div
                      className="int-room-hw-meter-bar"
                      style={{ width: `${Math.min(100, Math.round(audioVolume * 2.8))}%` }}
                    />
                  </div>
                  <div className="int-room-hw-meter-labels">
                    <span>Silent</span>
                    <span>{audioVolume > 15 ? 'Good Level' : 'Speak to test...'}</span>
                    <span>Peak</span>
                  </div>

                  {/* 3s Voice Sample Recording & Loopback Playback */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <button
                      type="button"
                      className={`int-room-hw-action-btn ${isTestingMicRecording ? 'is-active-recording' : ''}`}
                      onClick={handleRecordTestSample}
                      disabled={isTestingMicRecording}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="4" fill="currentColor" />
                      </svg>
                      {isTestingMicRecording ? `Recording... (${testRecordingCountdown}s)` : 'Record 3s Voice Sample'}
                    </button>

                    {testAudioUrl && (
                      <button
                        type="button"
                        className="int-room-hw-action-btn is-success"
                        onClick={handlePlayTestSample}
                        disabled={isPlayingTestAudio || isTestingMicRecording}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        {isPlayingTestAudio ? 'Playing Back...' : 'Play Back Sample'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Speaker Output Test */}
                <div className="int-room-hw-card">
                  <div className="int-room-hw-card-header">
                    <span className="int-room-hw-card-title">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      </svg>
                      Speaker / Headphones
                    </span>
                    <span className={`int-room-hw-status-pill ${speakerTestPassed ? 'is-ok' : 'is-warn'}`}>
                      {speakerTestPassed ? '✓ Tested' : 'Needs Test'}
                    </span>
                  </div>

                  <p className="int-room-hw-card-desc">
                    Click the button below to play a harmonic test chime. Make sure your headphones or speakers are unmuted so you can hear the AI interviewer.
                  </p>

                  <div style={{ marginTop: 'auto' }}>
                    <button
                      type="button"
                      className={`int-room-hw-action-btn ${speakerTestPassed ? 'is-success' : ''}`}
                      onClick={handlePlaySpeakerTestTone}
                      disabled={isPlayingSpeakerTest}
                      style={{ width: '100%' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                      {isPlayingSpeakerTest ? 'Playing Test Sound...' : speakerTestPassed ? '✓ Play Test Sound Again' : 'Play Speaker Test Sound'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Troubleshooting Notice if mic is blocked */}
              {micPermissionStatus === 'denied' && (
                <div className="int-room-hw-alert-box" style={{ borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    <strong>Microphone access is blocked:</strong> Click the padlock icon in your browser address bar to allow microphone permissions, or switch to Text Mode below.
                  </span>
                </div>
              )}

              {/* Quality confirmation note */}
              <div className="int-room-hw-alert-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>
                  <strong>Tip for Sri Lankan candidates:</strong> Natural pauses while gathering your thoughts are completely fine. The system waits 3 seconds of silence before finalizing each response.
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="int-room-hw-footer">
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="int-room-hw-text-fallback-btn"
                  onClick={() => {
                    setIsHardwareModalOpen(false)
                    setInterviewMode('text')
                    startOrResumeInterview('text', false)
                  }}
                >
                  Switch to Text Interview
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="int-room-hw-text-fallback-btn"
                  onClick={handleConfirmHardwareReady}
                  title="Skip check and start immediately"
                >
                  Skip Check
                </button>

                <button
                  type="button"
                  className="int-room-hw-primary-btn"
                  onClick={handleConfirmHardwareReady}
                >
                  <span>Looks & Sounds Good — Enter Interview →</span>
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

      {/* =====================================================================
          PAUSE INTERVIEW OVERLAY MODAL
          ===================================================================== */}
      {isPaused && (
        <div className="int-room-pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-modal-title">
          <div className="int-room-pause-modal">
            <div className="int-room-pause-modal__icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" color="#38bdf8">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </div>
            <div className="int-room-pause-modal__badge">Session Paused</div>
            <h2 id="pause-modal-title" className="int-room-pause-modal__title">Interview Is On Pause</h2>
            <p className="int-room-pause-modal__desc">
              The clock, interviewer voice, and speech recognition are paused. Take a breath, prepare your thoughts, or review your notes.
            </p>
            <div className="int-room-pause-modal__status-box">
              <div className="int-room-pause-modal__stat">
                <span className="int-room-pause-modal__stat-label">Elapsed Time:</span>
                <span className="int-room-pause-modal__stat-val">{formatTimer(secondsElapsed)}</span>
              </div>
              <div className="int-room-pause-modal__stat">
                <span className="int-room-pause-modal__stat-label">Progress:</span>
                <span className="int-room-pause-modal__stat-val">Stage {currentStageNumber} of {totalStages} ({currentStage?.name || 'In Progress'})</span>
              </div>
            </div>
            <div className="int-room-pause-modal__actions">
              <button
                type="button"
                className="int-room-pause-modal__resume-btn"
                onClick={handleTogglePause}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Resume Interview
              </button>
              <button
                type="button"
                className="int-room-pause-modal__end-btn"
                onClick={() => {
                  setIsPaused(false)
                  setIsEndModalOpen(true)
                }}
              >
                End Interview & View Evaluation →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          END INTERVIEW CONFIRMATION MODAL (Mid-way or complete conclusion)
          ===================================================================== */}
      {isEndModalOpen && (
        <div className="int-room-end-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="end-modal-title">
          <div className="int-room-end-modal">
            <div className="int-room-end-modal__icon-wrap">
              <img src={callHangupIcon} alt="" className="int-room-end-modal__icon" />
            </div>
            <h2 id="end-modal-title" className="int-room-end-modal__title">Conclude Interview Session?</h2>
            <p className="int-room-end-modal__desc">
              Are you sure you want to end this interview? All questions and answers discussed so far
              (<strong>Stage {currentStageNumber} of {totalStages}</strong>) will be safely preserved.
            </p>
            <div className="int-room-end-modal__ai-note">
              <span className="int-room-end-modal__ai-sparkle">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
              </span>
              <span>
                <strong>Comprehensive AI Evaluation:</strong> Our evaluation agent will thoroughly analyze all topics and answers covered during this session and generate your domain skill breakdown without penalizing for unreached stages.
              </span>
            </div>
            <div className="int-room-end-modal__actions">
              <button
                type="button"
                className="int-room-end-modal__cancel-btn"
                onClick={handleCancelEndModal}
                disabled={isEnding}
              >
                Keep Practicing
              </button>
              <button
                type="button"
                className="int-room-end-modal__confirm-btn"
                onClick={handleConfirmEndInterview}
                disabled={isEnding}
              >
                {isEnding ? (
                  <span className="int-room-end-modal__loading">
                    <span className="int-room-spinner" /> Concluding Session...
                  </span>
                ) : (
                  'Conclude & View Evaluation →'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          FEEDBACK COACHING MODAL / PANEL (Active in Feedback Interview Mode)
          ===================================================================== */}
      {activeFeedback && (
        <div
          className="int-room-feedback-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-panel-title"
        >
          <div className="int-room-feedback-panel">
            {/* Top Bar / Header */}
            <div className="int-room-feedback-header">
              <div className="int-room-feedback-header-left">
                <div className="int-room-feedback-badge">
                  <span className="int-room-feedback-badge-dot" />
                  FEEDBACK COACHING MODE • ANSWER EVALUATION
                </div>
                <h2 id="feedback-panel-title" className="int-room-feedback-title">
                  Immediate AI Feedback & Coaching
                </h2>
                <p className="int-room-feedback-subtitle">
                  Review how your response performed on key interview dimensions, learn actionable improvements, and continue when ready.
                </p>
              </div>

              {/* Overall Score Badge */}
              <div className="int-room-feedback-score-card">
                <div className="int-room-feedback-score-num">
                  {activeFeedback.score ?? activeFeedback.overallScore ?? '—'}
                  {(activeFeedback.score ?? activeFeedback.overallScore) != null && (
                    <span className="int-room-feedback-score-pct">%</span>
                  )}
                </div>
                <div className="int-room-feedback-score-label">ANSWER SCORE</div>
              </div>
            </div>

            <div className="int-room-feedback-body">
              {/* Coach unavailable: honest message + retry (no placeholder evaluation) */}
              {activeFeedback.unavailable && (
                <div className="int-room-feedback-err-banner" role="status">
                  <span>{activeFeedback.message || 'Feedback for this answer could not be generated right now.'}</span>
                  <button type="button" className="int-room-feedback-retry-btn" onClick={handleRetryFeedback} disabled={isRetryingFeedback}>
                    {isRetryingFeedback ? 'Retrying...' : 'Retry Evaluation'}
                  </button>
                </div>
              )}

              {/* Executive Summary */}
              {activeFeedback.summary && (
                <div className="int-room-feedback-summary-box">
                  <div className="int-room-feedback-summary-label">COACH SUMMARY</div>
                  <p className="int-room-feedback-summary-text">{activeFeedback.summary}</p>
                </div>
              )}

              {/* Reference Accordion: Question & Answer Context */}
              {feedbackContext && (
                <div className="int-room-feedback-context-block">
                  <div className="int-room-feedback-context-row">
                    <span className="int-room-feedback-context-label">QUESTION ASKED:</span>
                    <p className="int-room-feedback-context-q">{feedbackContext.question}</p>
                  </div>
                  <div className="int-room-feedback-context-row">
                    <span className="int-room-feedback-context-label">YOUR ANSWER:</span>
                    <div className="int-room-feedback-context-a">{feedbackContext.answer}</div>
                  </div>
                </div>
              )}

              {/* SECTION A: ANSWER EVALUATION CRITERIA METRICS */}
              {activeFeedback.evaluation && (
                <div className="int-room-feedback-section">
                  <h3 className="int-room-feedback-section-title">
                    <span className="int-room-feedback-section-num">A</span>
                    Evaluation Criteria Breakdown
                  </h3>
                  <div className="int-room-feedback-metrics-grid">
                    {[
                      { key: 'relevance', label: 'Relevance to Question' },
                      { key: 'technical_accuracy', label: 'Technical Accuracy & Depth' },
                      { key: 'clarity', label: 'Clarity & Organization' },
                      { key: 'completeness', label: 'Completeness of Response' },
                      { key: 'supporting_examples', label: 'Quality of Examples (STAR)' },
                      { key: 'communication', label: 'Communication Effectiveness' },
                    ].map(({ key, label }) => {
                      const item = activeFeedback.evaluation?.[key]
                      if (!item) return null
                      const scoreVal = typeof item === 'object' ? item.score : item
                      const comment = typeof item === 'object' ? item.comment : ''
                      return (
                        <div key={key} className="int-room-feedback-metric-card">
                          <div className="int-room-feedback-metric-header">
                            <span className="int-room-feedback-metric-name">{label}</span>
                            <span className={`int-room-feedback-metric-score ${scoreVal >= 75 ? 'is-high' : scoreVal >= 55 ? 'is-mid' : 'is-low'}`}>
                              {scoreVal}%
                            </span>
                          </div>
                          {comment && <p className="int-room-feedback-metric-comment">{comment}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* SECTIONS B & C: STRENGTHS & AREAS FOR IMPROVEMENT */}
              {!activeFeedback.unavailable && (
              <div className="int-room-feedback-columns-row">
                {/* Strengths */}
                <div className="int-room-feedback-card int-room-feedback-card--strengths">
                  <div className="int-room-feedback-card-heading">
                    <span className="int-room-feedback-card-badge is-green">B. Strengths</span>
                    <span className="int-room-feedback-card-sub">What you did well</span>
                  </div>
                  <ul className="int-room-feedback-list">
                    {!(activeFeedback.strengths && activeFeedback.strengths.length > 0) && (
                      <li className="int-room-feedback-list-item">
                        <span>No clear strengths were identified in this answer.</span>
                      </li>
                    )}
                    {(activeFeedback.strengths || []).map((str, idx) => (
                      <li key={idx} className="int-room-feedback-list-item">
                        <span className="int-room-feedback-icon-check">✓</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Areas for Improvement */}
                <div className="int-room-feedback-card int-room-feedback-card--improvements">
                  <div className="int-room-feedback-card-heading">
                    <span className="int-room-feedback-card-badge is-amber">C. Areas for Improvement</span>
                    <span className="int-room-feedback-card-sub">Gaps & missing evidence</span>
                  </div>
                  <ul className="int-room-feedback-list">
                    {(activeFeedback.areas_for_improvement || activeFeedback.areasForImprovement || []).map((imp, idx) => (
                      <li key={idx} className="int-room-feedback-list-item">
                        <span className="int-room-feedback-icon-target">→</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              )}

              {/* SECTION D: ACTIONABLE SUGGESTIONS */}
              {activeFeedback.actionable_suggestions && activeFeedback.actionable_suggestions.length > 0 && (
                <div className="int-room-feedback-section">
                  <h3 className="int-room-feedback-section-title">
                    <span className="int-room-feedback-section-num">D</span>
                    Actionable Recommendations for Next Answers
                  </h3>
                  <div className="int-room-feedback-suggestions-box">
                    {activeFeedback.actionable_suggestions.map((sug, idx) => (
                      <div key={idx} className="int-room-feedback-suggestion-row">
                        <span className="int-room-feedback-sug-num">{idx + 1}</span>
                        <span className="int-room-feedback-sug-text">{sug}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION E: IMPROVED ANSWER GUIDANCE */}
              {activeFeedback.improved_answer_guidance && (
                <div className="int-room-feedback-section">
                  <div className="int-room-feedback-guidance-card">
                    <div className="int-room-feedback-guidance-header">
                      <span className="int-room-feedback-section-num">E</span>
                      <div>
                        <h3 className="int-room-feedback-guidance-title">Improved Answer Guidance</h3>
                        <span className="int-room-feedback-guidance-tag">
                          Learning Example — Illustrative model structure, not candidate's original text
                        </span>
                      </div>
                    </div>

                    {activeFeedback.improved_answer_guidance.structure && (
                      <div className="int-room-feedback-model-structure">
                        <strong>Recommended Response Framework:</strong>{' '}
                        <span>{activeFeedback.improved_answer_guidance.structure}</span>
                      </div>
                    )}

                    {activeFeedback.improved_answer_guidance.example_model_answer && (
                      <div className="int-room-feedback-model-quote">
                        <div className="int-room-feedback-model-quote-lbl">ILLUSTRATIVE MODEL ANSWER:</div>
                        <p>{activeFeedback.improved_answer_guidance.example_model_answer}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error banner if retry failed */}
              {feedbackError && (
                <div className="int-room-feedback-err-banner">
                  <span>{feedbackError}</span>
                  <button type="button" className="int-room-feedback-retry-btn" onClick={handleRetryFeedback} disabled={isRetryingFeedback}>
                    {isRetryingFeedback ? 'Retrying...' : 'Retry Evaluation'}
                  </button>
                </div>
              )}
            </div>

            {/* ACTION FOOTER */}
            <div className="int-room-feedback-footer">
              <div className="int-room-feedback-footer-left">
                {pendingTurnData?.nextQuestion && (
                  <span className="int-room-feedback-next-hint">
                    Adaptive follow-up question ready: &ldquo;{pendingTurnData.nextQuestion.slice(0, 75)}...&rdquo;
                  </span>
                )}
              </div>
              <div className="int-room-feedback-footer-right">
                <button
                  type="button"
                  className="int-room-feedback-retry-subtle-btn"
                  onClick={handleRetryFeedback}
                  disabled={isRetryingFeedback}
                  title="Re-run AI evaluation on this answer"
                >
                  {isRetryingFeedback ? 'Re-evaluating...' : 'Re-evaluate Answer'}
                </button>

                <button
                  type="button"
                  className="int-room-feedback-continue-btn"
                  onClick={handleContinueFromFeedback}
                >
                  <span>
                    {pendingTurnData?.isComplete
                      ? 'Complete Interview & View Final Report →'
                      : 'Continue to Next Question →'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

