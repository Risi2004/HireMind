import { useContext } from 'react'
import { ProfileSetupContext } from './profileSetupContextObject'

export function useProfileSetup() {
  const context = useContext(ProfileSetupContext)
  if (!context) {
    throw new Error('useProfileSetup must be used within ProfileSetupProvider')
  }
  return context
}
