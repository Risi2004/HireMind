import { createContext } from 'react'

// Shared context object; the provider lives in AuthContext.jsx and the hook in useAuth.js
export const AuthContext = createContext(null)
