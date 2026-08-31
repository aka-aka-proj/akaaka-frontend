// oxlint-disable react/only-export-components -- React context module intentionally co-locates Provider and hook; fast-refresh limitation accepted and documented (issue #99).
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface AppError {
  title?: string
  message: string
  response?: unknown
  debugInfo?: unknown
}

interface ErrorContextType {
  error: AppError | null
  showError: (
    err: AppError | Error | string,
    response?: unknown,
    debugInfo?: unknown
  ) => void
  clearError: () => void
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setErrorState] = useState<AppError | null>(null)

  // Stable identity: consumers list showError/clearError in hook deps.
  const showError = useCallback((
    err: AppError | Error | string,
    response?: any,
    debugInfo?: any
  ) => {
    if (typeof err === 'string') {
      setErrorState({
        message: err,
        response,
        debugInfo,
      })
    } else if (err instanceof Error) {
      const extended = err as Error & { response?: unknown }
      setErrorState({
        title: err.name,
        message: err.message,
        response: response || extended.response || undefined,
        debugInfo: debugInfo || err.stack || undefined,
      })
    } else {
      setErrorState({
        title: err.title,
        message: err.message,
        response: err.response !== undefined ? err.response : response,
        debugInfo: err.debugInfo !== undefined ? err.debugInfo : debugInfo,
      })
    }
  }, [])

  const clearError = useCallback(() => {
    setErrorState(null)
  }, [])

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
    </ErrorContext.Provider>
  )
}

export function useError() {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider')
  }
  return context
}
