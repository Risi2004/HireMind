/**
 * HireMind Interview Session Persistence & State Manager
 * Handles unique session generation, localStorage persistence,
 * and resuming interviews at their exact last visited status/page.
 * NO dummy/seed data — only genuine user-created interviews.
 */

import company1Icon from '../assets/icons/company1.svg'
import company2Icon from '../assets/icons/company2.svg'

const STORAGE_KEY = 'hiremind_user_interviews'

// Legacy dummy IDs to purge if found in browser storage
const DUMMY_IDS = new Set([
  'r1', 'r2', 'r3', 'r4', 'm1', 'm2', 'm3', 'p1', 'p2', 'p3',
  'wso2-intern-01', 'sysco-backend-02', 'wso2-intern-03', 'sysco-backend-04',
  'wso2-intern-05', 'sysco-backend-06', 'wso2-intern-07'
])

/**
 * Generates a unique ID for interview sessions.
 * Uses native crypto.randomUUID() where available, with fallback.
 */
export function generateInterviewId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'int_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9)
}

/**
 * Fetch all stored interview sessions created by the user.
 * Returns empty array [] if none exist.
 */
export function getAllInterviewSessions() {
  try {
    // Purge old storage key if it exists
    if (localStorage.getItem('hiremind_interview_sessions')) {
      localStorage.removeItem('hiremind_interview_sessions')
    }

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    // Filter out any legacy dummy records
    const cleanList = parsed.filter((item) => item && item.id && !DUMMY_IDS.has(item.id))
    if (cleanList.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList))
    }

    return cleanList
  } catch (err) {
    console.warn('Error reading interviews from localStorage:', err)
    return []
  }
}

/**
 * Fetch a single interview session by its unique ID.
 */
export function getInterviewSession(id) {
  if (!id) return null
  const all = getAllInterviewSessions()
  return all.find((item) => String(item.id) === String(id)) || null
}

/**
 * Save or update an interview session in localStorage.
 * Automatically timestamps and keeps sorted with most recent first.
 */
export function saveInterviewSession(sessionData) {
  if (!sessionData || !sessionData.id) return null

  // Reject dummy IDs
  if (DUMMY_IDS.has(sessionData.id)) return null

  try {
    const all = getAllInterviewSessions()
    const index = all.findIndex((item) => String(item.id) === String(sessionData.id))

    const companyName = sessionData.company || (index >= 0 ? all[index].company : '')
    const roleName = sessionData.targetRole || sessionData.title || (index >= 0 ? all[index].title : 'Interview Session')

    const updatedSession = {
      ...(index >= 0 ? all[index] : {}),
      ...sessionData,
      title: roleName,
      targetRole: sessionData.targetRole || roleName,
      company: companyName,
      track: sessionData.interviewType ? `${sessionData.interviewType} Interview` : (index >= 0 ? all[index].track : 'Technical'),
      updatedAt: new Date().toISOString(),
    }

    if (!updatedSession.createdAt) {
      updatedSession.createdAt = new Date().toISOString()
    }
    if (!updatedSession.icon) {
      updatedSession.icon = companyName.toLowerCase().includes('sysco') ? company2Icon : company1Icon
    }

    let newList
    if (index >= 0) {
      newList = [...all]
      newList[index] = updatedSession
      // Move recently updated interview to front
      newList.splice(index, 1)
      newList.unshift(updatedSession)
    } else {
      newList = [updatedSession, ...all]
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newList))

    // Broadcast change event so Dashboard and active tabs refresh immediately
    window.dispatchEvent(new CustomEvent('hiremind_interviews_updated', { detail: updatedSession }))

    return updatedSession
  } catch (err) {
    console.error('Error saving interview session:', err)
    return sessionData
  }
}

/**
 * Creates a brand new interview session with a unique ID and persists it.
 */
export function createInterviewSession(overrides = {}) {
  const uniqueId = generateInterviewId()
  const role = overrides.targetRole || overrides.title || 'New Interview'
  const company = overrides.company || ''

  const newSession = {
    id: uniqueId,
    title: role,
    targetRole: role,
    company: company,
    track: overrides.interviewType ? `${overrides.interviewType} Interview` : 'Technical',
    interviewType: overrides.interviewType || 'Technical',
    difficulty: overrides.difficulty || 'Intermediate',
    duration: overrides.duration || '30 min',
    jobDescription: overrides.jobDescription || '',
    uploadedResume: overrides.uploadedResume || null,
    isGithubConnected: Boolean(overrides.isGithubConnected),
    status: 'setup',
    lastVisitedPath: `/new-interview/${uniqueId}`,
    icon: company.toLowerCase().includes('sysco') ? company2Icon : company1Icon,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }

  saveInterviewSession(newSession)
  return newSession
}
