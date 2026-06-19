import { useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

interface RawPointerProps {
  onSingleClick?: (e: ThreeEvent<PointerEvent>) => void
  onDoubleClick?: (e: ThreeEvent<PointerEvent>) => void
  doubleClickDelay?: number
  dragThreshold?: number // Allow up to 10 pixels of trackpad sliding before calling it a "drag"
}

/**
 * A highly forgiving interaction hook designed for trackpads.
 * It measures the physical slide distance and the exact millisecond delta between taps.
 */
export function useRawPointerInteraction({ 
  onSingleClick, 
  onDoubleClick, 
  doubleClickDelay = 200, 
  dragThreshold = 10 
}: RawPointerProps) {
  
  const pointerDownState = useRef({ x: 0, y: 0, time: 0 })
  const lastPointerUpTime = useRef(0)
  const singleClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return 
    pointerDownState.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    }
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return

    const now = Date.now()
    const startState = pointerDownState.current

    // 1. Calculate distance traveled (Pythagorean theorem)
    const dx = e.clientX - startState.x
    const dy = e.clientY - startState.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 2. Was it a drag?
    if (distance > dragThreshold) return

    // It was a valid stationary tap.
    e.stopPropagation()

    const delta = now - lastPointerUpTime.current
    
    // Log the rhythm so the user can see their speed in the console
    if (lastPointerUpTime.current !== 0 && delta < 1000) {
      console.log(`[RHYTHM] Gap between taps: ${delta}ms (Target: <${doubleClickDelay}ms)`)
    }

    if (delta < doubleClickDelay) {
      // DOUBLE CLICK DETECTED
      if (singleClickTimer.current) clearTimeout(singleClickTimer.current)
      lastPointerUpTime.current = 0 
      if (onDoubleClick) onDoubleClick(e)
    } else {
      // POSSIBLE SINGLE CLICK
      lastPointerUpTime.current = now
      
      if (singleClickTimer.current) clearTimeout(singleClickTimer.current)
      
      singleClickTimer.current = setTimeout(() => {
        // Timer expired. No second tap came.
        lastPointerUpTime.current = 0
        if (onSingleClick) onSingleClick(e)
      }, doubleClickDelay)
    }
  }

  return { onPointerDown, onPointerUp }
}
