import { useRef, useCallback } from 'react'

/**
 * A bulletproof interaction hook that strictly separates single clicks from double clicks.
 * It uses a 250ms delay to ensure single clicks do not fire during a double-click or drag gesture,
 * completely preventing the React re-render race condition that breaks trackpad gripping.
 */
export function useDebouncedInteraction({
  onSingleClick,
  onDoubleClick,
  delay = 250
}: {
  onSingleClick?: (e: any) => void
  onDoubleClick?: (e: any) => void
  delay?: number
}) {
  const timer = useRef<NodeJS.Timeout | null>(null)
  
  // We use this flag to ensure we don't accidentally fire a single click if the user is dragging.
  // We set it to true on pointer down, and false on pointer up.
  const isPointerDown = useRef(false)

  const handleClick = useCallback((e: any) => {
    e.stopPropagation()

    // If a timer is already running, this is the second click of a double click!
    // We do nothing here, because the onDoubleClick handler will catch it.
    if (timer.current) {
      return
    }

    // Start the stopwatch.
    timer.current = setTimeout(() => {
      timer.current = null
      // If the timer runs out and they aren't currently holding the mouse down to drag, it's a valid single click.
      if (!isPointerDown.current && onSingleClick) {
        onSingleClick(e)
      }
    }, delay)
  }, [onSingleClick, delay])

  const handleDoubleClick = useCallback((e: any) => {
    e.stopPropagation()
    
    // We absolutely confirm a double click happened. 
    // Immediately kill the single-click timer so it never fires.
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }

    if (onDoubleClick) {
      onDoubleClick(e)
    }
  }, [onDoubleClick])

  const handlePointerDown = useCallback(() => {
    isPointerDown.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    isPointerDown.current = false
  }, [])

  return { 
    onClick: handleClick, 
    onDoubleClick: handleDoubleClick,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp
  }
}
