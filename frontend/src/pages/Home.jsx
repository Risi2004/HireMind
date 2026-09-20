import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import logoDarkImg from '../assets/images/logo-dark.png'
import brain3DImg from '../assets/images/Group 4.png'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()

  // State for interactive hero role selector
  const roles = [
    'Full-Stack Developer',
    'System Design & Architecture',
    'Machine Learning / AI Engineer',
    'Frontend Specialist (React/Next)',
    'Engineering Manager / Leadership',
  ]
  const [selectedRole, setSelectedRole] = useState(roles[0])

  // Interactive Live Simulation State
  const [isSimulatingVoice, setIsSimulatingVoice] = useState(true)
  const [simScore, setSimScore] = useState({ technical: 94, communication: 89, confidence: 96 })

  // Journey Stepper State
  const [activeStep, setActiveStep] = useState(0)

  // Pricing Interval Toggle
  const [billingCycle, setBillingCycle] = useState('monthly') // 'monthly' | 'annual'

  // Mobile Navigation Drawer Toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // FAQ Accordion
  const [openFaq, setOpenFaq] = useState(0)

  // Smooth Scroll Helper with sticky navbar offset
  const scrollToSection = (e, id) => {
    if (e && e.preventDefault) e.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      const navbarHeight = 84
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - navbarHeight
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  // Review Form State
  const [rating, setRating] = useState(5)
  const [feedbackForm, setFeedbackForm] = useState({
    fullName: '',
    email: '',
    role: '',
    review: '',
  })
  const [submittedFeedback, setSubmittedFeedback] = useState(false)

  // Auto-pulse simulation stats slightly for a lively feeling
  useEffect(() => {
    const interval = setInterval(() => {
      setSimScore((prev) => ({
        technical: Math.min(99, Math.max(88, prev.technical + (Math.random() > 0.5 ? 1 : -1))),
        communication: Math.min(98, Math.max(85, prev.communication + (Math.random() > 0.5 ? 1 : -1))),
        confidence: Math.min(99, Math.max(90, prev.confidence + (Math.random() > 0.5 ? 1 : -1))),
      }))
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  const journeySteps = [
    {
      step: '01',
      title: 'Upload Resume & Sync GitHub',
      tagline: 'Deep Context Extraction',
      desc: 'Our neural parser digests your actual codebase, past architecture choices, languages, and technical contributions to curate razor-sharp questions.',
      preview: {
        badge: 'Context Ingested',
        primary: 'Analyzed 14 repositories & 240+ commits',
        secondary: 'Primary Stack: React, Node.js, TypeScript, PostgreSQL, Docker',
      },
    },
    {
      step: '02',
      title: 'Target Role & Company Rubric',
      tagline: 'Calibrated Hiring Bar',
      desc: 'Select from 500+ top tech companies (Google, Meta, Stripe, Netflix) or paste custom job descriptions to mirror their real grading rubric.',
      preview: {
        badge: 'Rubric Calibrated',
        primary: 'Meta E5 Software Engineer Track',
        secondary: 'Evaluation Focus: High concurrency, cache consistency, trade-off depth',
      },
    },
    {
      step: '03',
      title: 'Real-Time Voice AI Interview',
      tagline: 'Natural Conversational Stress Test',
      desc: 'Experience low-latency voice dialogue. The AI listens, follows up on vague claims, challenges edge cases, and guides you like a Staff Engineer.',
      preview: {
        badge: 'Live Voice Session',
        primary: '"How would you avoid cache thundering herd in your Redis layer?"',
        secondary: 'Adaptive follow-up triggered based on candidate response',
      },
    },
    {
      step: '04',
      title: 'Comprehensive Diagnostic Scorecard',
      tagline: 'Actionable Offer-Winning Insights',
      desc: 'Receive immediate breakdown of architectural depth, verbal conciseness, filler-word frequency, and exact ways to elevate your answers.',
      preview: {
        badge: 'Scorecard Ready',
        primary: 'Overall Performance: 93% (Strong Hire Benchmark)',
        secondary: 'Recommendation: Clarify write-ahead log persistence trade-offs',
      },
    },
  ]

  const features = [
    {
      id: 'voice',
      badge: 'Real-Time Audio',
      title: 'Natural AI Voice Interviews',
      desc: 'Experience fluid, zero-awkward-pause voice conversations. The AI interviewer adapts its tone, asks spontaneous follow-ups, and tests your thinking under pressure.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      ),
    },
    {
      id: 'github',
      badge: 'Code Integrity',
      title: 'GitHub Repository Deep-Dives',
      desc: 'Unlike generic question banks, HireMind inspects your real GitHub repositories, questioning your PR decisions, design patterns, and package choices.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
          <path d="M9 18c-4.51 2-5-2-7-2" />
        </svg>
      ),
    },
    {
      id: 'adaptive',
      badge: 'Dynamic Difficulty',
      title: 'Adaptive Question Engine',
      desc: 'If you answer cleanly, the AI escalates to deeper system design constraints. If you stumble, it provides realistic hints just like a supportive human interviewer.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m4.93 4.93 4.24 4.24" />
          <path d="m14.83 9.17 4.24-4.24" />
          <path d="m14.83 14.83 4.24 4.24" />
          <path d="m9.17 14.83-4.24 4.24" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ),
    },
    {
      id: 'communication',
      badge: 'Speech Analysis',
      title: 'Speech & STAR Analysis',
      desc: 'Track speaking cadence, filler word frequency, and structural coherence. Perfect the STAR method for behavioral rounds and leadership evaluations.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 10h.01" />
          <path d="M12 10h.01" />
          <path d="M16 10h.01" />
        </svg>
      ),
    },
    {
      id: 'rubrics',
      badge: 'Targeted Practice',
      title: 'Company-Specific Rubrics',
      desc: 'Simulate the exact grading rubrics of Google, Amazon (Leadership Principles), Meta, Apple, and tier-1 startups to eliminate surprise on game day.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10" />
          <path d="M6 10h10" />
        </svg>
      ),
    },
    {
      id: 'roadmap',
      badge: 'Mastery Path',
      title: 'Targeted Improvement Roadmap',
      desc: 'HireMind pinpoints your specific conceptual gaps and generates tailored daily 15-minute drills until your answers meet staff-level excellence.',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
  ]

  const faqs = [
    {
      question: 'How does HireMind personalize my interview questions?',
      answer:
        'HireMind extracts structured intelligence from your resume, connected GitHub repositories, and target role requirements. It identifies your actual tech stack, past project architecture decisions, and senior-level trade-offs to ask realistic questions tailored strictly to you.',
    },
    {
      question: 'Can I simulate company-specific interview formats (like Google or Amazon)?',
      answer:
        'Yes! HireMind includes pre-configured assessment rubrics for over 500 top technology companies. For Amazon, it benchmarks against the 16 Leadership Principles; for Google, it tests algorithmic reasoning and Googlyness; for Meta, it evaluates fast-paced system design scalability.',
    },
    {
      question: 'How does the voice practice work? Do I need special software?',
      answer:
        'No installation needed. HireMind runs natively in any modern web browser using WebRTC and low-latency neural speech synthesis. You speak naturally into your microphone, and HireMind responds in real-time with zero noticeable lag.',
    },
    {
      question: 'Is my resume and GitHub code kept private and secure?',
      answer:
        'Absolutely. Your uploaded resumes, code snippets, and audio recordings are encrypted at rest (AES-256) and in transit (TLS 1.3). Your data is never sold or used to train public foundation models.',
    },
    {
      question: 'Can I switch between Free and Pro at any time?',
      answer:
        'Yes. You can start with our Free tier to experience daily interview practice. Upgrading to Pro unlocks unlimited voice sessions, full repository deep-dives, and detailed diagnostic scorecards with a 14-day money-back guarantee.',
    },
  ]

  const candidateReviews = [
    {
      initials: 'AR',
      color: 'blue',
      name: 'Alex Rivera',
      role: 'Software Engineer @ Google Cloud',
      rating: 5,
      text: 'The GitHub deep-dive was surreal. The AI asked me about a concurrency issue in a side project from 8 months ago that I had almost forgotten. Two weeks later, my Google interviewer asked almost the exact same scenario. Worth 100x the subscription.',
    },
    {
      initials: 'SL',
      color: 'indigo',
      name: 'Sarah Lin',
      role: 'Senior Frontend Engineer @ Stripe',
      rating: 5,
      text: 'Voice practice eliminated my interview anxiety. Hearing an AI challenge my architectural trade-offs in real time taught me how to structure my answers concisely with the STAR method.',
    },
    {
      initials: 'DK',
      color: 'cyan',
      name: 'David Kumar',
      role: 'Staff Engineer @ Datadog',
      rating: 5,
      text: 'The latency is so low it felt like speaking to an actual Staff Engineer on Zoom. The post-interview feedback highlighted my filler words and helped me present with 3x more executive presence.',
    },
    {
      initials: 'ER',
      color: 'purple',
      name: 'Elena Rostova',
      role: 'Staff Machine Learning Engineer @ Meta',
      rating: 5,
      text: 'HireMind probed my understanding of KV-caching and distributed attention mechanisms during LLM inference. The questions were harder and more realistic than my real interviews.',
    },
    {
      initials: 'MV',
      color: 'emerald',
      name: 'Marcus Vance',
      role: 'Lead Systems Architect @ Netflix',
      rating: 5,
      text: 'Practicing microservice resilience and chaos engineering scenarios with voice follow-ups gave me supreme confidence going into my principal interviews.',
    },
    {
      initials: 'CZ',
      color: 'blue',
      name: 'Chloe Zhang',
      role: 'Backend Engineer @ Amazon AWS',
      rating: 5,
      text: 'The Leadership Principles simulation helped me frame every past conflict and delivery deadline using data-driven STAR stories. Received an offer in 3 days!',
    },
  ]

  const handleFeedbackSubmit = (e) => {
    e.preventDefault()
    if (!feedbackForm.fullName.trim() || !feedbackForm.review.trim()) return
    setSubmittedFeedback(true)
    setTimeout(() => {
      setSubmittedFeedback(false)
      setFeedbackForm({ fullName: '', email: '', role: '', review: '' })
    }, 4500)
  }

  return (
    <div className="hiremind-landing">
      {/* Background Ambient Aura Glows */}
      <div className="ambient-glow ambient-glow--top" aria-hidden="true" />
      <div className="ambient-glow ambient-glow--center" aria-hidden="true" />

      {/* =========================================================================
          1. HEADER / NAVBAR
          ========================================================================= */}
      <header className="hm-navbar">
        <div className="hm-navbar__inner">
          <div className="hm-navbar__brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={logoDarkImg} alt="HireMind" className="hm-navbar__logo" />
          </div>

          <nav className="hm-navbar__nav" aria-label="Main Navigation">
            <a href="#how-it-works" className="hm-nav-link" onClick={(e) => scrollToSection(e, 'how-it-works')}>
              How It Works
            </a>
            <a href="#features" className="hm-nav-link" onClick={(e) => scrollToSection(e, 'features')}>
              Features
            </a>
            <a href="#pricing" className="hm-nav-link" onClick={(e) => scrollToSection(e, 'pricing')}>
              Pricing
            </a>
            <a href="#testimonials" className="hm-nav-link" onClick={(e) => scrollToSection(e, 'testimonials')}>
              Reviews
            </a>
            <a href="#faq" className="hm-nav-link" onClick={(e) => scrollToSection(e, 'faq')}>
              FAQ
            </a>
          </nav>

          <div className="hm-navbar__actions">
            <button
              type="button"
              className="hm-btn hm-btn--ghost hm-navbar__signin-btn"
              onClick={() => navigate('/login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className="hm-btn hm-btn--primary hm-navbar__cta-btn"
              onClick={() => navigate('/signup')}
            >
              <span className="hm-cta-full">Start Free Practice</span>
              <span className="hm-cta-compact">Practice</span>
              <span className="hm-btn__arrow">→</span>
            </button>
            <button
              type="button"
              className={`hm-navbar__toggle ${isMobileMenuOpen ? 'is-active' : ''}`}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <span className="hm-toggle-bar" />
              <span className="hm-toggle-bar" />
              <span className="hm-toggle-bar" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div className={`hm-mobile-menu ${isMobileMenuOpen ? 'is-open' : ''}`} aria-hidden={!isMobileMenuOpen}>
          <nav className="hm-mobile-menu__nav" aria-label="Mobile Navigation">
            <a
              href="#how-it-works"
              className="hm-mobile-nav-link"
              onClick={(e) => {
                setIsMobileMenuOpen(false)
                scrollToSection(e, 'how-it-works')
              }}
            >
              <span className="hm-mobile-nav-num">01</span>
              <span>How It Works</span>
            </a>
            <a
              href="#features"
              className="hm-mobile-nav-link"
              onClick={(e) => {
                setIsMobileMenuOpen(false)
                scrollToSection(e, 'features')
              }}
            >
              <span className="hm-mobile-nav-num">02</span>
              <span>Features</span>
            </a>
            <a
              href="#pricing"
              className="hm-mobile-nav-link"
              onClick={(e) => {
                setIsMobileMenuOpen(false)
                scrollToSection(e, 'pricing')
              }}
            >
              <span className="hm-mobile-nav-num">03</span>
              <span>Pricing</span>
            </a>
            <a
              href="#testimonials"
              className="hm-mobile-nav-link"
              onClick={(e) => {
                setIsMobileMenuOpen(false)
                scrollToSection(e, 'testimonials')
              }}
            >
              <span className="hm-mobile-nav-num">04</span>
              <span>Reviews</span>
            </a>
            <a
              href="#faq"
              className="hm-mobile-nav-link"
              onClick={(e) => {
                setIsMobileMenuOpen(false)
                scrollToSection(e, 'faq')
              }}
            >
              <span className="hm-mobile-nav-num">05</span>
              <span>FAQ</span>
            </a>
          </nav>

          <div className="hm-mobile-menu__actions">
            <button
              type="button"
              className="hm-btn hm-btn--ghost hm-mobile-menu__btn"
              onClick={() => {
                setIsMobileMenuOpen(false)
                navigate('/login')
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className="hm-btn hm-btn--primary hm-mobile-menu__btn"
              onClick={() => {
                setIsMobileMenuOpen(false)
                navigate('/signup')
              }}
            >
              Start Free Practice
              <span className="hm-btn__arrow">→</span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. HERO SECTION
          ========================================================================= */}
      <section className="hm-hero">
        <div className="hm-hero__container">
          {/* Top Announcement Chip */}
          <div className="hm-hero__badge" onClick={() => navigate('/profile-setup')}>
            <span className="hm-badge-dot" />
            <span className="hm-badge-text">Next-Gen Voice AI Interview Coach v2.4</span>
            <span className="hm-badge-arrow">Explore Live Demo →</span>
          </div>

          {/* Hero Main Headline */}
          <h1 className="hm-hero__headline">
            Ace Every Interview With{' '}
            <span className="hm-gradient-text">Personalized AI</span> Coaching
          </h1>

          <p className="hm-hero__subheadline">
            Turn mock practice into dream offer letters. Experience real-time adaptive voice sessions
            that analyze your speech, challenge your system design, and evaluate your GitHub code like a
            Staff Engineer.
          </p>

          {/* Quick Role Selector Filter */}
          <div className="hm-hero__roles-wrapper">
            <span className="hm-roles-label">Select Your Target Track:</span>
            <div className="hm-roles-pills">
              {roles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`hm-role-pill ${selectedRole === role ? 'hm-role-pill--active' : ''}`}
                  onClick={() => setSelectedRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="hm-hero__cta-group">
            <button
              type="button"
              className="hm-btn hm-btn--hero-primary"
              onClick={() => navigate('/signup')}
            >
              <span className="hm-btn-icon-sparkle">✦</span>
              Start Mock Interview Free
              <span className="hm-btn__arrow">→</span>
            </button>

            <button
              type="button"
              className="hm-btn hm-btn--hero-secondary"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="hm-play-icon">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              See How It Works
            </button>
          </div>

          {/* Trust Metrics Strip */}
          <div className="hm-trust-strip">
            <div className="hm-trust-metric">
              <span className="hm-trust-val">94.2%</span>
              <span className="hm-trust-lbl">Offer Success Rate</span>
            </div>
            <div className="hm-trust-divider" />
            <div className="hm-trust-metric">
              <span className="hm-trust-val">150,000+</span>
              <span className="hm-trust-lbl">Sessions Completed</span>
            </div>
            <div className="hm-trust-divider" />
            <div className="hm-trust-metric">
              <span className="hm-trust-val">4.9 / 5.0</span>
              <span className="hm-trust-lbl">Candidate Rating</span>
            </div>
            <div className="hm-trust-divider" />
            <div className="hm-trust-companies">
              <span>Alumni Hired At:</span>
              <strong>Google</strong> • <strong>Meta</strong> • <strong>Stripe</strong> • <strong>Amazon</strong>
            </div>
          </div>

          {/* =========================================================================
              HERO LIVE INTERACTIVE MOCKUP COCKPIT
              ========================================================================= */}
          <div className="hm-cockpit">
            <div className="hm-cockpit__window">
              {/* Window Bar */}
              <div className="hm-cockpit__header">
                <div className="hm-window-controls">
                  <span className="dot dot--red" />
                  <span className="dot dot--yellow" />
                  <span className="dot dot--green" />
                </div>
                <div className="hm-cockpit__title-bar">
                  <span className="hm-pulse-indicator" />
                  <span>HireMind AI Interactive Studio — {selectedRole}</span>
                </div>
                <div className="hm-cockpit__latency-badge">Latency: 180ms • Neural Audio v3</div>
              </div>

              {/* Window Main Grid */}
              <div className="hm-cockpit__body">
                {/* Left: AI Question & Voice Visualizer */}
                <div className="hm-cockpit__left">
                  <div className="hm-ai-message-card">
                    <div className="hm-ai-header">
                      <img src={brain3DImg} alt="AI Coach" className="hm-ai-avatar" />
                      <div>
                        <div className="hm-ai-name">HireMind Neural Interviewer</div>
                        <div className="hm-ai-role">Specialized in {selectedRole}</div>
                      </div>
                      <span className="hm-ai-tag">Targeting Staff L6</span>
                    </div>

                    <p className="hm-ai-prompt">
                      &quot;Looking at your architecture in your GitHub repo: How did you mitigate
                      split-brain scenarios and manage distributed lock expiration during high database failover?&quot;
                    </p>
                  </div>

                  {/* Audio Frequency Equalizer Bar */}
                  <div className="hm-audio-studio">
                    <div className="hm-audio-studio__header">
                      <span>Candidate Voice Input (Live Analysis)</span>
                      <button
                        type="button"
                        className="hm-audio-toggle"
                        onClick={() => setIsSimulatingVoice(!isSimulatingVoice)}
                      >
                        {isSimulatingVoice ? 'Pause Mic' : 'Resume Mic'}
                      </button>
                    </div>

                    <div className="hm-audio-equalizer">
                      {[18, 42, 78, 92, 64, 85, 96, 54, 72, 88, 60, 35, 70, 94, 52, 38].map((h, i) => (
                        <span
                          key={i}
                          className="hm-eq-bar"
                          style={{
                            height: isSimulatingVoice ? `${Math.max(12, h * (0.6 + (i % 3) * 0.2))}px` : '8px',
                            animationDelay: `${i * 0.08}s`,
                          }}
                        />
                      ))}
                    </div>

                    <div className="hm-audio-studio__footer">
                      <span className="hm-mic-status">
                        <span className="hm-mic-dot" />
                        Listening: Speaking pace optimal (135 wpm)
                      </span>
                      <span className="hm-speech-sentiment">Clarity: High • Sentiment: Confident</span>
                    </div>
                  </div>
                </div>

                {/* Right: Live AI Diagnostic Metrics */}
                <div className="hm-cockpit__right">
                  <div className="hm-metrics-card">
                    <h4 className="hm-metrics-title">Live Response Evaluator</h4>

                    <div className="hm-metric-gauge">
                      <div className="hm-gauge-header">
                        <span>Technical Depth</span>
                        <strong>{simScore.technical}%</strong>
                      </div>
                      <div className="hm-gauge-bar">
                        <div className="hm-gauge-fill hm-gauge-fill--cyan" style={{ width: `${simScore.technical}%` }} />
                      </div>
                    </div>

                    <div className="hm-metric-gauge">
                      <div className="hm-gauge-header">
                        <span>Communication &amp; Structure</span>
                        <strong>{simScore.communication}%</strong>
                      </div>
                      <div className="hm-gauge-bar">
                        <div className="hm-gauge-fill hm-gauge-fill--blue" style={{ width: `${simScore.communication}%` }} />
                      </div>
                    </div>

                    <div className="hm-metric-gauge">
                      <div className="hm-gauge-header">
                        <span>Confidence &amp; Delivery</span>
                        <strong>{simScore.confidence}%</strong>
                      </div>
                      <div className="hm-gauge-bar">
                        <div className="hm-gauge-fill hm-gauge-fill--indigo" style={{ width: `${simScore.confidence}%` }} />
                      </div>
                    </div>

                    <div className="hm-cockpit-tip">
                      <span className="hm-tip-icon">💡</span>
                      <p>
                        <strong>AI Instant Coaching:</strong> Great point on distributed leasing!
                        Remember to state the exact TTL trade-off before going into Raft quorum consensus.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="hm-btn hm-btn--start-cockpit"
                      onClick={() => navigate('/profile-setup')}
                    >
                      Practice This Question Live →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. SECTION: HOW IT WORKS (THE 4-STEP JOURNEY)
          ========================================================================= */}
      <section id="how-it-works" className="hm-section hm-journey-section">
        <div className="hm-container">
          <div className="hm-section-header text-center">
            <span className="hm-section-tag">Methodology</span>
            <h2 className="hm-section-title">Your Journey to Interview Mastery</h2>
            <p className="hm-section-subtitle">
              From analyzing your raw code to conducting realistic live voice simulations,
              here is how HireMind trains you to crack top-tier hiring loops.
            </p>
          </div>

          <div className="hm-journey-grid">
            {/* Step Navigation Tabs */}
            <div className="hm-journey-tabs">
              {journeySteps.map((item, idx) => (
                <div
                  key={idx}
                  className={`hm-journey-step-card ${activeStep === idx ? 'hm-journey-step-card--active' : ''}`}
                  onClick={() => setActiveStep(idx)}
                >
                  <div className="hm-step-num">{item.step}</div>
                  <div className="hm-step-content">
                    <span className="hm-step-tagline">{item.tagline}</span>
                    <h3 className="hm-step-title">{item.title}</h3>
                    <p className="hm-step-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Step Interactive Visual Display */}
            <div className="hm-journey-display">
              <div className="hm-journey-display__card">
                <div className="hm-display-badge">
                  <span className="hm-display-pulse" />
                  {journeySteps[activeStep].preview.badge}
                </div>
                <h3 className="hm-display-headline">{journeySteps[activeStep].title}</h3>
                <div className="hm-display-panel">
                  <div className="hm-display-panel__line hm-display-panel__line--primary">
                    {journeySteps[activeStep].preview.primary}
                  </div>
                  <div className="hm-display-panel__line hm-display-panel__line--secondary">
                    {journeySteps[activeStep].preview.secondary}
                  </div>
                </div>

                <div className="hm-display-footer">
                  <span>Step {activeStep + 1} of 4</span>
                  <button
                    type="button"
                    className="hm-display-cta-btn"
                    onClick={() => navigate('/profile-setup')}
                  >
                    Try This Step in Profile Setup →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. SECTION: BENTO FEATURE SUITE
          ========================================================================= */}
      <section id="features" className="hm-section hm-features-section">
        <div className="hm-container">
          <div className="hm-section-header text-center">
            <span className="hm-section-tag">Feature Suite</span>
            <h2 className="hm-section-title">Everything You Need to Get Interview-Ready</h2>
            <p className="hm-section-subtitle">
              Engineered specifically for engineering, design, and product candidates targeting high-bar teams.
            </p>
          </div>

          <div className="hm-bento-grid">
            {features.map((feat) => (
              <div key={feat.id} className="hm-bento-card">
                <div className="hm-bento-top">
                  <div className="hm-bento-icon-box">{feat.icon}</div>
                  <span className="hm-bento-badge">{feat.badge}</span>
                </div>
                <h3 className="hm-bento-title">{feat.title}</h3>
                <p className="hm-bento-desc">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. SECTION: PRICING (PRACTICE MORE. GROW FASTER.)
          ========================================================================= */}
      <section id="pricing" className="hm-section hm-pricing-section">
        <div className="hm-container">
          <div className="hm-section-header text-center">
            <span className="hm-section-tag">Transparent Pricing</span>
            <h2 className="hm-section-title">Practice More. Grow Faster.</h2>
            <p className="hm-section-subtitle">
              Traditional mock interviews charge $150+/hour for human sessions. HireMind delivers unlimited,
              superior intelligence for a fraction of the cost.
            </p>

            {/* Billing Toggle */}
            <div className="hm-billing-toggle-wrapper">
              <button
                type="button"
                className={`hm-toggle-btn ${billingCycle === 'monthly' ? 'hm-toggle-btn--active' : ''}`}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                className={`hm-toggle-btn ${billingCycle === 'annual' ? 'hm-toggle-btn--active' : ''}`}
                onClick={() => setBillingCycle('annual')}
              >
                Annual Billing <span className="hm-discount-pill">Save 25%</span>
              </button>
            </div>
          </div>

          <div className="hm-pricing-grid">
            {/* Free Plan */}
            <div className="hm-plan-card">
              <div className="hm-plan-header">
                <span className="hm-plan-name">Free Starter</span>
                <p className="hm-plan-sub">Perfect for discovering your current baseline</p>
                <div className="hm-plan-price">
                  <span className="hm-currency">$</span>
                  <span className="hm-amount">0</span>
                  <span className="hm-period">/ month</span>
                </div>
              </div>

              <ul className="hm-plan-features">
                <li><span className="hm-check">✓</span> 1 Full Mock Voice Interview per day</li>
                <li><span className="hm-check">✓</span> Basic Communication &amp; Speech summary</li>
                <li><span className="hm-check">✓</span> Standard resume text parser</li>
                <li><span className="hm-check">✓</span> Community forum access</li>
              </ul>

              <button
                type="button"
                className="hm-btn hm-btn--plan-outline"
                onClick={() => navigate('/profile-setup')}
              >
                Get Started Free
              </button>
            </div>

            {/* Pro Plan (Recommended) */}
            <div className="hm-plan-card hm-plan-card--pro">
              <div className="hm-pro-ribbon">MOST POPULAR • RECOMMENDED</div>

              <div className="hm-plan-header">
                <span className="hm-plan-name hm-plan-name--pro">Pro Career</span>
                <p className="hm-plan-sub">Designed for active candidates targeting offers</p>
                <div className="hm-plan-price">
                  <span className="hm-currency">$</span>
                  <span className="hm-amount">{billingCycle === 'annual' ? '7.50' : '10'}</span>
                  <span className="hm-period">/ month</span>
                </div>
                {billingCycle === 'annual' && <span className="hm-billed-annually">Billed annually ($90/year)</span>}
              </div>

              <ul className="hm-plan-features">
                <li><span className="hm-check hm-check--glow">✓</span> <strong>Unlimited</strong> AI Voice Interviews</li>
                <li><span className="hm-check hm-check--glow">✓</span> <strong>Deep GitHub Repository</strong> commit inspection</li>
                <li><span className="hm-check hm-check--glow">✓</span> <strong>Company-Specific</strong> rubrics (FAANG / Tier-1)</li>
                <li><span className="hm-check hm-check--glow">✓</span> Real-time speech cadence &amp; filler-word tracking</li>
                <li><span className="hm-check hm-check--glow">✓</span> Personalized Daily Improvement Roadmap</li>
                <li><span className="hm-check hm-check--glow">✓</span> Full interview transcripts &amp; audio replay</li>
              </ul>

              <button
                type="button"
                className="hm-btn hm-btn--plan-pro"
                onClick={() => navigate('/profile-setup')}
              >
                Upgrade to Pro
                <span className="hm-btn__arrow">→</span>
              </button>
            </div>

            {/* Institution Plan */}
            <div className="hm-plan-card">
              <div className="hm-plan-header">
                <span className="hm-plan-name">Institution</span>
                <p className="hm-plan-sub">For universities, bootcamps &amp; career teams</p>
                <div className="hm-plan-price">
                  <span className="hm-amount">Custom</span>
                </div>
              </div>

              <ul className="hm-plan-features">
                <li><span className="hm-check">✓</span> Bulk candidate seat management</li>
                <li><span className="hm-check">✓</span> Institutional analytics &amp; readiness dashboard</li>
                <li><span className="hm-check">✓</span> Custom department grading rubrics</li>
                <li><span className="hm-check">✓</span> Dedicated account manager &amp; SLA support</li>
                <li><span className="hm-check">✓</span> SSO &amp; LMS integrations</li>
              </ul>

              <button
                type="button"
                className="hm-btn hm-btn--plan-outline"
                onClick={() => navigate('/profile-setup')}
              >
                Contact Admissions / Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. SECTION: TESTIMONIALS & FEEDBACK
          ========================================================================= */}
      <section id="testimonials" className="hm-section hm-testimonials-section">
        <div className="hm-container">
          <div className="hm-section-header text-center">
            <span className="hm-section-tag">Candidate Stories</span>
            <h2 className="hm-section-title">What Our Candidates Say</h2>
            <p className="hm-section-subtitle">
              Join thousands of engineers, designers, and managers who used HireMind to negotiate top offers.
            </p>
          </div>

          <div className="hm-testimonials-grid">
            {/* Reviews Column with Infinite Vertical Auto-Scroll (Top to Bottom) */}
            <div className="hm-reviews-viewport" title="Hover to pause scroll">
              <div className="hm-reviews-scroll-track">
                {[...candidateReviews, ...candidateReviews].map((rev, index) => (
                  <div key={index} className="hm-review-card">
                    <div className="hm-review-header">
                      <div className={`hm-avatar hm-avatar--${rev.color}`}>{rev.initials}</div>
                      <div>
                        <div className="hm-reviewer-name">{rev.name}</div>
                        <div className="hm-reviewer-role">{rev.role}</div>
                      </div>
                      <div className="hm-review-stars">{'★'.repeat(rev.rating)}</div>
                    </div>
                    <p className="hm-review-text">&quot;{rev.text}&quot;</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Feedback Form */}
            <div className="hm-feedback-box">
              <div className="hm-feedback-box__header">
                <h3 className="hm-feedback-title">Share Your Experience</h3>
                <div className="hm-star-selector">
                  <span className="hm-star-label">Rating:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`hm-star-btn ${star <= rating ? 'hm-star-btn--filled' : ''}`}
                      onClick={() => setRating(star)}
                      aria-label={`${star} Stars`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <form className="hm-feedback-form" onSubmit={handleFeedbackSubmit}>
                <div className="hm-form-row">
                  <div className="hm-form-group">
                    <label htmlFor="name">Full Name</label>
                    <input
                      id="name"
                      type="text"
                      placeholder="e.g. Jordan Miller"
                      value={feedbackForm.fullName}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="hm-form-group">
                    <label htmlFor="email">Work / Personal Email</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="jordan@example.com"
                      value={feedbackForm.email}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="hm-form-group">
                  <label htmlFor="role">Target Role &amp; Company</label>
                  <input
                    id="role"
                    type="text"
                    placeholder="e.g. Senior Backend Engineer @ Stripe"
                    value={feedbackForm.role}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, role: e.target.value })}
                  />
                </div>

                <div className="hm-form-group">
                  <label htmlFor="review">Your Review or Feature Request</label>
                  <textarea
                    id="review"
                    rows={4}
                    placeholder="Tell us what you loved or what you'd like to see improved..."
                    value={feedbackForm.review}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, review: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="hm-btn hm-btn--feedback-submit">
                  {submittedFeedback ? 'Thank You! Review Recorded ✓' : 'Submit Review / Feedback →'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. SECTION: FAQ ACCORDION
          ========================================================================= */}
      <section id="faq" className="hm-section hm-faq-section">
        <div className="hm-container hm-container--narrow">
          <div className="hm-section-header text-center">
            <span className="hm-section-tag">Got Questions?</span>
            <h2 className="hm-section-title">Frequently Asked Questions</h2>
            <p className="hm-section-subtitle">
              Everything you need to know about our privacy, AI evaluation, and practice methodology.
            </p>
          </div>

          <div className="hm-faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <div
                  key={index}
                  className={`hm-faq-card ${isOpen ? 'hm-faq-card--open' : ''}`}
                >
                  <button
                    type="button"
                    className="hm-faq-question-btn"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <span className="hm-faq-icon">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="hm-faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. HIGH-IMPACT FINAL CALL TO ACTION BANNER
          ========================================================================= */}
      <section className="hm-cta-banner-section">
        <div className="hm-container">
          <div className="hm-cta-banner">
            <div className="hm-cta-banner__content">
              <span className="hm-cta-pill">Level Up Your Career</span>
              <h2 className="hm-cta-title">Ready to Land Your Dream Tech Offer?</h2>
              <p className="hm-cta-desc">
                Join 150,000+ candidates using HireMind to master behavioral rounds, system design,
                and technical deep-dives with zero stage fright.
              </p>
              <div className="hm-cta-actions">
                <button
                  type="button"
                  className="hm-btn hm-btn--banner-primary"
                  onClick={() => navigate('/profile-setup')}
                >
                  Build Your Candidate Profile
                  <span className="hm-btn__arrow">→</span>
                </button>
                <button
                  type="button"
                  className="hm-btn hm-btn--banner-secondary"
                  onClick={() => navigate('/profile-setup/about-you')}
                >
                  Upload Resume Directly
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. FOOTER
          ========================================================================= */}
      <footer className="hm-footer">
        <div className="hm-container">
          <div className="hm-footer__top">
            <div className="hm-footer__brand-col">
              <img src={logoDarkImg} alt="HireMind" className="hm-footer__logo" />
              <p className="hm-footer__motto">
                The intelligent, voice-first AI career coach engineered to help top-tier talent
                master real-world technical and leadership interviews.
              </p>
            </div>

            <div className="hm-footer__links-group">
              <div className="hm-footer__col">
                <div className="hm-footer__heading">Product</div>
                <a href="#how-it-works" className="hm-footer-link" onClick={(e) => scrollToSection(e, 'how-it-works')}>
                  How It Works
                </a>
                <a href="#features" className="hm-footer-link" onClick={(e) => scrollToSection(e, 'features')}>
                  Voice AI Studio
                </a>
                <a href="#features" className="hm-footer-link" onClick={(e) => scrollToSection(e, 'features')}>
                  GitHub Analyzer
                </a>
                <a href="#pricing" className="hm-footer-link" onClick={(e) => scrollToSection(e, 'pricing')}>
                  Pricing Plans
                </a>
              </div>

              <div className="hm-footer__col">
                <div className="hm-footer__heading">Onboarding</div>
                <a onClick={() => navigate('/profile-setup')} className="hm-footer-link">Profile Setup</a>
                <a onClick={() => navigate('/profile-setup/about-you')} className="hm-footer-link">Upload Resume</a>
                <a onClick={() => navigate('/profile-setup/your-field')} className="hm-footer-link">Select Field</a>
                <a onClick={() => navigate('/profile-setup/career-stage')} className="hm-footer-link">Career Stage</a>
              </div>

              <div className="hm-footer__col">
                <div className="hm-footer__heading">Legal &amp; Trust</div>
                <a href="#privacy" onClick={(e) => e.preventDefault()} className="hm-footer-link">Privacy Policy</a>
                <a href="#terms" onClick={(e) => e.preventDefault()} className="hm-footer-link">Terms of Service</a>
                <a href="#security" onClick={(e) => e.preventDefault()} className="hm-footer-link">Security &amp; Encryption</a>
              </div>
            </div>
          </div>

          <div className="hm-footer__bottom">
            <div className="hm-footer__copyright">
              &copy; {new Date().getFullYear()} HireMind Technologies Inc. All rights reserved.
            </div>
            <div className="hm-footer__status">
              <span className="hm-status-dot" />
              All Systems Operational • Neural Voice Engine Online
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
