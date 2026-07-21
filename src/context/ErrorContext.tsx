import { createContext, useContext, useState, ReactNode } from 'react'

export interface AppError {
  title?: string
  message: string
  response?: any
  debugInfo?: any
}

interface ErrorContextType {
  error: AppError | null
  showError: (
    err: AppError | Error | string,
    response?: any,
    debugInfo?: any
  ) => void
  clearError: () => void
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setErrorState] = useState<AppError | null>(null)

  const showError = (
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
      setErrorState({
        title: err.name,
        message: err.message,
        response: response || (err as any).response || undefined,
        debugInfo: debugInfo || (err as any).stack || undefined,
      })
    } else {
      setErrorState({
        title: err.title,
        message: err.message,
        response: err.response !== undefined ? err.response : response,
        debugInfo: err.debugInfo !== undefined ? err.debugInfo : debugInfo,
      })
    }
  }

  const clearError = () => {
    setErrorState(null)
  }

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
