import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollVisibility } from './useScrollVisibility'

function Probe() {
  const visible = useScrollVisibility()
  return <div data-testid="visibility" data-visible={visible ? 'true' : 'false'} />
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value })
}

let pendingFrame: FrameRequestCallback | null = null

function flushFrame() {
  act(() => {
    pendingFrame?.(0)
    pendingFrame = null
  })
}

describe('useScrollVisibility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pendingFrame = callback
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
    setScrollY(0)
  })

  afterEach(() => {
    pendingFrame = null
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('hides on downward scroll and reveals on upward scroll or idle', () => {
    render(<Probe />)
    const visibility = screen.getByTestId('visibility')

    setScrollY(100)
    fireEvent.scroll(window)
    flushFrame()
    expect(visibility.getAttribute('data-visible')).toBe('false')

    setScrollY(80)
    fireEvent.scroll(window)
    flushFrame()
    expect(visibility.getAttribute('data-visible')).toBe('true')

    setScrollY(180)
    fireEvent.scroll(window)
    flushFrame()
    expect(visibility.getAttribute('data-visible')).toBe('false')
    act(() => vi.advanceTimersByTime(700))
    expect(visibility.getAttribute('data-visible')).toBe('true')
  })

  it('reveals when the document reaches the bottom or focus enters the page', () => {
    render(<Probe />)
    const visibility = screen.getByTestId('visibility')

    setScrollY(100)
    fireEvent.scroll(window)
    flushFrame()
    expect(visibility.getAttribute('data-visible')).toBe('false')

    setScrollY(1176)
    fireEvent.scroll(window)
    flushFrame()
    expect(visibility.getAttribute('data-visible')).toBe('true')

    setScrollY(0)
    fireEvent.scroll(window)
    flushFrame()
    setScrollY(100)
    fireEvent.scroll(window)
    flushFrame()
    expect(visibility.getAttribute('data-visible')).toBe('false')
    fireEvent.focusIn(document.body)
    expect(visibility.getAttribute('data-visible')).toBe('true')
  })
})
