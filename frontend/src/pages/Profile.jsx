import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import brandMarkImg from '../assets/images/3.png'
import backArrowIcon from '../assets/icons/back arrow.svg'
import logoutIcon from '../assets/icons/logout.svg'
import emailIcon from '../assets/icons/email.svg'
import tick2Icon from '../assets/icons/tick2.svg'
import careerInfoIcon from '../assets/icons/career information.svg'
import editIcon from '../assets/icons/edit.svg'
import connectedProfilesIcon from '../assets/icons/connected profiles.svg'
import profileShowIcon from '../assets/icons/profile show.svg'
import skillsIcon from '../assets/icons/skills.svg'
import addIcon from '../assets/icons/add.svg'
import closeIcon from '../assets/icons/close.svg'
import githubIcon from '../assets/icons/Vector.svg'
import linkedinIcon from '../assets/icons/linkedin.svg'
import Navbar from '../components/Navbar'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // Profile data states
  const [profileData, setProfileData] = useState({
    name: 'Jazeel Jaufer',
    tier: 'FREE',
    title: 'Software Engineering Student',
    email: 'jazeel.jaufer@example.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
    resumeFileName: 'Johndoe_resume_2024.Pdf',
    careerStage: 'University Student',
    field: 'Software Engineering',
    experienceLevel: 'Intermediate',
  })

  // Edit Career Info Modal/Inline state
  const [isEditingCareer, setIsEditingCareer] = useState(false)
  const [editFields, setEditFields] = useState({
    careerStage: 'University Student',
    field: 'Software Engineering',
    experienceLevel: 'Intermediate',
  })

  // Career Interests list state
  const [careerInterests, setCareerInterests] = useState([
    'Backend Development',
    'Full Stack Development',
    'AI Engineering',
  ])
  const [isAddingInterest, setIsAddingInterest] = useState(false)
  const [newInterestInput, setNewInterestInput] = useState('')

  // Connected Profiles state
  const [profiles, setProfiles] = useState({
    linkedin: {
      connected: true,
      name: 'Jazeel Jaufer',
      status: 'Connected',
    },
    github: {
      connected: true,
      username: 'jazeeljaufer',
      repoCount: '12 Repositories',
    },
  })

  // Skills & Expertise list state
  const [skills, setSkills] = useState([
    'React',
    'MongoDB',
    'Node.js',
    'SQL',
    'Java',
    'Python',
    'Git',
    'Spring Boot',
  ])
  const [isAddingSkill, setIsAddingSkill] = useState(false)
  const [newSkillInput, setNewSkillInput] = useState('')

  // Handle Resume File Selection / Drag & Drop
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfileData((prev) => ({
        ...prev,
        resumeFileName: file.name,
      }))
      alert(`Resume successfully updated to: ${file.name}`)
    }
  }

  // Handle Career Info Save
  const handleSaveCareer = (e) => {
    e.preventDefault()
    setProfileData((prev) => ({
      ...prev,
      careerStage: editFields.careerStage,
      field: editFields.field,
      experienceLevel: editFields.experienceLevel,
    }))
    setIsEditingCareer(false)
  }

  // Handle Add Career Interest
  const handleAddInterest = (e) => {
    e.preventDefault()
    if (newInterestInput.trim()) {
      setCareerInterests((prev) => [...prev, newInterestInput.trim()])
      setNewInterestInput('')
      setIsAddingInterest(false)
    }
  }

  // Handle Remove Career Interest
  const handleRemoveInterest = (interestToRemove) => {
    setCareerInterests((prev) => prev.filter((item) => item !== interestToRemove))
  }

  // Handle Add Skill
  const handleAddSkill = (e) => {
    e.preventDefault()
    if (newSkillInput.trim() && !skills.includes(newSkillInput.trim())) {
      setSkills((prev) => [...prev, newSkillInput.trim()])
      setNewSkillInput('')
      setIsAddingSkill(false)
    }
  }

  // Handle Remove Skill
  const handleRemoveSkill = (skillToRemove) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove))
  }

  // Handle Logout
  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to log out of HireMind?')
    if (confirmLogout) {
      navigate('/login')
    }
  }

  return (
    <div className="prof-page">
      {/* Background dotted grid ambience */}
      <div className="prof-bg-dots" aria-hidden="true" />
      <div className="prof-glow-orb prof-glow-orb--top" aria-hidden="true" />
      <div className="prof-glow-orb prof-glow-orb--bottom" aria-hidden="true" />

      {/* =====================================================================
          TOP APP HEADER
          ===================================================================== */}
      <Navbar
        logoRedirect="/dashboard"
        initial="J"
        userName={profileData.name}
        userEmail={profileData.email}
      />

      {/* =====================================================================
          PAGE TITLE & LOGOUT BAR
          ===================================================================== */}
      <div className="prof-container">
        <div className="prof-title-row">
          <div className="prof-title-left">
            <button
              type="button"
              className="prof-back-btn"
              onClick={() => navigate('/dashboard')}
              title="Return to Dashboard"
            >
              <img src={backArrowIcon} alt="" className="prof-back-icon" />
              <span>BACK TO DASHBOARD</span>
            </button>
            <h1 className="prof-heading">My Profile</h1>
          </div>

          <div className="prof-title-right">
            <button type="button" className="prof-logout-btn" onClick={handleLogout} title="Log Out">
              <img src={logoutIcon} alt="" className="prof-logout-icon" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            1. HERO / PROFILE SUMMARY CARD
            ===================================================================== */}
        <section className="prof-hero-card">
          {/* Left: User Identity Info */}
          <div className="prof-hero-user">
            <div className="prof-avatar-wrap">
              <img
                src={profileData.avatar}
                alt={profileData.name}
                className="prof-avatar-img"
              />
              <div className="prof-avatar-badge" title="Online & Active" />
            </div>

            <div className="prof-hero-meta">
              <div className="prof-name-row">
                <h2 className="prof-user-name">{profileData.name}</h2>
                <span className="prof-tier-pill">{profileData.tier}</span>
              </div>
              <p className="prof-user-subtitle">{profileData.title}</p>
              <div className="prof-email-pill">
                <img src={emailIcon} alt="Email" className="prof-email-icon" />
                <span>{profileData.email}</span>
              </div>
            </div>
          </div>

          {/* Right: Upload Resume Card */}
          <div
            className="prof-resume-card"
            onClick={() => fileInputRef.current?.click()}
            title="Click to Upload or Replace Resume"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
            />

            <div className="prof-resume-top-row">
              <div className="prof-resume-file-info">
                <img src={tick2Icon} alt="" className="prof-resume-check" />
                <span className="prof-resume-filename">{profileData.resumeFileName}</span>
              </div>
              <button
                type="button"
                className="prof-resume-replace-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                REPLACE
              </button>
            </div>

            <div className="prof-resume-cta-wrap">
              <h4 className="prof-resume-cta-title">Upload Resume</h4>
              <p className="prof-resume-cta-desc">Drag & Drop or Click to Browse (PDF, DOCX)</p>
            </div>
          </div>
        </section>

        {/* =====================================================================
            2. MIDDLE ROW (3 COLUMNS: Career Info, Career Interests, Connected Profiles)
            ===================================================================== */}
        <div className="prof-middle-grid">
          {/* CARD 1: Career Information */}
          <section className="prof-card prof-card--career">
            <div className="prof-card-header">
              <div className="prof-card-title-group">
                <div className="prof-card-icon-wrap is-purple">
                  <img src={careerInfoIcon} alt="" className="prof-card-icon" />
                </div>
                <h3 className="prof-card-title">Career Information</h3>
              </div>
              <button
                type="button"
                className="prof-card-action-btn"
                onClick={() => {
                  setEditFields({
                    careerStage: profileData.careerStage,
                    field: profileData.field,
                    experienceLevel: profileData.experienceLevel,
                  })
                  setIsEditingCareer((prev) => !prev)
                }}
                title="Edit Career Details"
                aria-label="Edit Career Information"
              >
                <img src={editIcon} alt="Edit" className="prof-action-icon" />
              </button>
            </div>

            {isEditingCareer ? (
              <form className="prof-career-edit-form" onSubmit={handleSaveCareer}>
                <div className="prof-edit-field">
                  <label className="prof-edit-label">CAREER STAGE</label>
                  <input
                    type="text"
                    className="prof-edit-input"
                    value={editFields.careerStage}
                    onChange={(e) => setEditFields({ ...editFields, careerStage: e.target.value })}
                  />
                </div>
                <div className="prof-edit-field">
                  <label className="prof-edit-label">FIELD</label>
                  <input
                    type="text"
                    className="prof-edit-input"
                    value={editFields.field}
                    onChange={(e) => setEditFields({ ...editFields, field: e.target.value })}
                  />
                </div>
                <div className="prof-edit-field">
                  <label className="prof-edit-label">EXPERIENCE LEVEL</label>
                  <input
                    type="text"
                    className="prof-edit-input"
                    value={editFields.experienceLevel}
                    onChange={(e) => setEditFields({ ...editFields, experienceLevel: e.target.value })}
                  />
                </div>
                <div className="prof-edit-actions">
                  <button type="submit" className="prof-btn-save">
                    Save
                  </button>
                  <button
                    type="button"
                    className="prof-btn-cancel"
                    onClick={() => setIsEditingCareer(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="prof-career-grid">
                <div className="prof-career-item">
                  <span className="prof-field-label">CAREER STAGE</span>
                  <span className="prof-field-val">{profileData.careerStage}</span>
                </div>
                <div className="prof-career-item">
                  <span className="prof-field-label">FIELD</span>
                  <span className="prof-field-val">{profileData.field}</span>
                </div>
                <div className="prof-career-item">
                  <span className="prof-field-label">EXPERIENCE LEVEL</span>
                  <span className="prof-field-val">{profileData.experienceLevel}</span>
                </div>
              </div>
            )}
          </section>

          {/* CARD 2: Career Interests (Featured with cyan accent dashed frame) */}
          <section className="prof-card prof-card--interests">
            <div className="prof-card-header prof-interests-header">
              <div className="prof-interests-title-wrap">
                <h3 className="prof-interests-title">CAREER INTERESTS</h3>
              </div>
            </div>

            <div className="prof-interests-list">
              {careerInterests.map((interest) => (
                <div key={interest} className="prof-interest-pill">
                  <span>{interest}</span>
                  <button
                    type="button"
                    className="prof-interest-remove"
                    onClick={() => handleRemoveInterest(interest)}
                    title={`Remove ${interest}`}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {isAddingInterest ? (
                <form className="prof-interest-add-form" onSubmit={handleAddInterest}>
                  <input
                    type="text"
                    className="prof-interest-input"
                    placeholder="e.g. Cloud DevOps"
                    autoFocus
                    value={newInterestInput}
                    onChange={(e) => setNewInterestInput(e.target.value)}
                  />
                  <button type="submit" className="prof-interest-add-btn">
                    Add
                  </button>
                  <button
                    type="button"
                    className="prof-interest-cancel-btn"
                    onClick={() => setIsAddingInterest(false)}
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="prof-interest-pill prof-interest-pill--add"
                  onClick={() => setIsAddingInterest(true)}
                  title="Add new career interest"
                >
                  <span>Add Interest</span>
                  <img src={addIcon} alt="" className="prof-add-icon" />
                </button>
              )}
            </div>
          </section>

          {/* CARD 3: Connected Profiles */}
          <section className="prof-card prof-card--connected">
            <div className="prof-card-header">
              <div className="prof-card-title-group">
                <img src={connectedProfilesIcon} alt="" className="prof-card-icon" />
                <h3 className="prof-card-title">Connected Profiles</h3>
              </div>
            </div>

            <div className="prof-connected-list">
              {/* LinkedIn Row */}
              <div className="prof-connected-item">
                <div className="prof-connected-left">
                  <div className="prof-soc-icon-wrap linkedin">
                    <img src={linkedinIcon} alt="LinkedIn" className="prof-soc-icon" />
                  </div>
                  <div className="prof-soc-meta">
                    <span className="prof-soc-name">{profiles.linkedin.name}</span>
                    <span className="prof-soc-status is-connected">{profiles.linkedin.status}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="prof-soc-action"
                  title="Manage LinkedIn profile"
                  onClick={() => alert('LinkedIn profile linked: Jazeel Jaufer')}
                >
                  <img src={profileShowIcon} alt="Unlink / View" className="prof-unlink-icon" />
                </button>
              </div>

              {/* GitHub Row */}
              <div className="prof-connected-item">
                <div className="prof-connected-left">
                  <div className="prof-soc-icon-wrap github">
                    <img src={githubIcon} alt="GitHub" className="prof-soc-icon" />
                  </div>
                  <div className="prof-soc-meta">
                    <span className="prof-soc-name">{profiles.github.username}</span>
                    <span className="prof-soc-status">{profiles.github.repoCount}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="prof-soc-action"
                  title="Manage GitHub repositories"
                  onClick={() => alert('GitHub account linked: jazeeljaufer')}
                >
                  <img src={profileShowIcon} alt="Unlink / View" className="prof-unlink-icon" />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* =====================================================================
            3. BOTTOM CARD: SKILLS & EXPERTISE
            ===================================================================== */}
        <section className="prof-card prof-card--skills">
          <div className="prof-card-header">
            <div className="prof-card-title-group">
              <img src={skillsIcon} alt="" className="prof-card-icon" />
              <h3 className="prof-card-title">Skills & Expertise</h3>
            </div>

            <button
              type="button"
              className="prof-add-skill-trigger"
              onClick={() => setIsAddingSkill((prev) => !prev)}
              title="Add a technical skill"
            >
              <img src={addIcon} alt="" className="prof-btn-add-icon" />
              <span>ADD SKILL</span>
            </button>
          </div>

          {isAddingSkill && (
            <form className="prof-add-skill-form" onSubmit={handleAddSkill}>
              <input
                type="text"
                className="prof-add-skill-input"
                placeholder="e.g. Docker, Kubernetes, GraphQL"
                autoFocus
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
              />
              <button type="submit" className="prof-skill-submit-btn">
                Add
              </button>
              <button
                type="button"
                className="prof-skill-close-btn"
                onClick={() => setIsAddingSkill(false)}
              >
                Cancel
              </button>
            </form>
          )}

          <div className="prof-skills-wrap">
            {skills.map((skill) => (
              <div key={skill} className="prof-skill-chip">
                <span className="prof-skill-name">{skill}</span>
                <button
                  type="button"
                  className="prof-skill-del-btn"
                  onClick={() => handleRemoveSkill(skill)}
                  title={`Remove ${skill}`}
                  aria-label={`Remove ${skill}`}
                >
                  <img src={closeIcon} alt="Remove" className="prof-skill-del-icon" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
