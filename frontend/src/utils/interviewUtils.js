/**
 * HireMind Interview Session Persistence & State Manager
 * Handles unique session generation, localStorage persistence,
 * and resuming interviews at their exact last visited status/page.
 * NO dummy/seed data — only genuine user-created interviews.
 */

import company1Icon from '../assets/icons/company1.svg'
import company2Icon from '../assets/icons/company2.svg'
import { getApiUrl } from '../config/api'

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

    // Filter out any legacy dummy records and sanitize legacy 'New Interview' in targetRole
    const cleanList = parsed
      .filter((item) => item && item.id && !DUMMY_IDS.has(item.id))
      .map((item) => {
        const clean = { ...item }
        if (clean.targetRole === 'New Interview') {
          clean.targetRole = ''
        }
        // Sanitize legacy dummy score placeholders (84%, 79%, 94%) if session has no real evaluation
        if (clean.score && (clean.score === '84%' || clean.score === '79%' || clean.score === '94%')) {
          if (!clean.evaluation && typeof clean.overallScore !== 'number') {
            clean.score = null
          }
        }
        return clean
      })
    if (cleanList.length !== parsed.length || JSON.stringify(cleanList) !== raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList))
    }

    return cleanList
  } catch (err) {
    console.warn('Error reading interviews from localStorage:', err)
    return []
  }
}

/**
 * Synchronize stored sessions with backend MongoDB database so genuine AI evaluations
 * and actual scores are always up-to-date across all devices and tabs.
 */
export async function syncUserInterviewsFromBackend() {
  try {
    const token = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
    if (!token) return getAllInterviewSessions()

    const res = await fetch(getApiUrl('/api/interview/my-sessions'), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) return getAllInterviewSessions()

    const data = await res.json()
    if (!data.success || !Array.isArray(data.sessions)) {
      return getAllInterviewSessions()
    }

    const localSessions = getAllInterviewSessions()
    const mergedMap = new Map()

    for (const session of localSessions) {
      mergedMap.set(String(session.id), session)
    }

    for (const remote of data.sessions) {
      const existing = mergedMap.get(String(remote.id)) || {}
      const evalScore = remote.overallScore ?? remote.evaluation?.overallScore ?? null

      const merged = {
        ...existing,
        ...remote,
        score: evalScore !== null ? `${evalScore}%` : (existing.score || null),
        overallScore: evalScore !== null ? evalScore : (existing.overallScore ?? null),
        evaluation: remote.evaluation || existing.evaluation || null,
        status: remote.status || existing.status || 'setup',
        company: remote.company || existing.company || '',
        targetRole: remote.targetRole || existing.targetRole || '',
        title: remote.title || existing.title || (remote.targetRole || (remote.company ? `${remote.company} Interview` : 'New Interview')),
        lastVisitedPath: remote.lastVisitedPath || existing.lastVisitedPath || (
          (remote.status === 'completed' || remote.status === 'ended_by_user')
            ? `/interview-report?id=${remote.id}`
            : `/new-interview/${remote.id}`
        ),
      }
      mergedMap.set(String(remote.id), merged)
    }

    const updatedList = Array.from(mergedMap.values()).sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return timeB - timeA
    })

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList))
    window.dispatchEvent(new CustomEvent('hiremind_interviews_updated', { detail: updatedList }))

    return updatedList
  } catch (err) {
    console.warn('Error syncing interview sessions from backend:', err)
    return getAllInterviewSessions()
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
    const roleName = sessionData.targetRole && sessionData.targetRole !== 'New Interview'
      ? sessionData.targetRole
      : (index >= 0 && all[index].targetRole !== 'New Interview' ? all[index].targetRole : '')
    const displayTitle = sessionData.title || roleName || (companyName ? `${companyName} Interview` : 'New Interview')

    const updatedSession = {
      ...(index >= 0 ? all[index] : {}),
      ...sessionData,
      title: displayTitle,
      targetRole: sessionData.targetRole !== undefined
        ? (sessionData.targetRole === 'New Interview' ? '' : sessionData.targetRole)
        : (index >= 0 ? (all[index].targetRole === 'New Interview' ? '' : all[index].targetRole) : ''),
      company: companyName,
      track: sessionData.interviewType ? `${sessionData.interviewType} Interview` : (index >= 0 ? all[index].track : 'Role-Specific Interview'),
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
  const role = overrides.targetRole && overrides.targetRole !== 'New Interview' ? overrides.targetRole : ''
  const company = overrides.company || ''

  const newSession = {
    id: uniqueId,
    title: role || (company ? `${company} Interview` : 'New Interview'),
    targetRole: role,
    company: company,
    track: overrides.interviewType ? `${overrides.interviewType} Interview` : 'Role-Specific Interview',
    interviewType: overrides.interviewType || 'Role-Specific',
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

/**
 * Permanently delete an interview session and all associated data from localStorage and MongoDB.
 */
export async function deleteInterviewSession(id) {
  if (!id) return false

  try {
    // 1. Remove from localStorage
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item) => String(item.id) !== String(id))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      }
    }

    // 2. Remove related session caches
    try {
      localStorage.removeItem(`hiremind_chat_${id}`)
      localStorage.removeItem(`hiremind_eval_${id}`)
      localStorage.removeItem(`hiremind_feedback_${id}`)
      localStorage.removeItem(`hiremind_session_${id}`)
    } catch { /* non-critical; safe to ignore */ }

    // 3. Delete from backend MongoDB
    try {
      const activeToken = localStorage.getItem('hiremind_token') || localStorage.getItem('token')
      await fetch(getApiUrl(`/api/interview/${id}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
      })
    } catch (netErr) {
      console.warn('Backend interview delete call error (continuing local removal):', netErr)
    }

    // 4. Broadcast change event so Dashboard, drawers, and all tabs update immediately
    window.dispatchEvent(new CustomEvent('hiremind_interviews_updated', { detail: { id, deleted: true } }))

    return true
  } catch (err) {
    console.error('Error deleting interview session:', err)
    return false
  }
}
