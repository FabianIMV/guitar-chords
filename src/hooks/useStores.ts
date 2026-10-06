import { useSyncExternalStore } from 'react'
import { getPrefs, subscribePrefs, type Prefs } from '../lib/settings'
import { storageVersion, subscribeStorage } from '../lib/storage'

/** Current preferences; re-renders when any of them change. */
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs)
}

/** A number that bumps whenever favorites/recents/history change. */
export function useStorageVersion(): number {
  return useSyncExternalStore(subscribeStorage, storageVersion)
}
