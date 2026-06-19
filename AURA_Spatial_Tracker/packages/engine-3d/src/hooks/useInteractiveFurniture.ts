import { useState, useRef } from 'react'
import { useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useSpatialStore } from '@aura/state-store'
import { useDrag } from '@use-gesture/react'

interface InteractionProps {
  id: string
  onSingleClick?: () => void
  onDoubleClick?: () => void
}

export function useInteractiveFurniture({ id, onSingleClick, onDoubleClick }: InteractionProps) {
  const updatePosition = useSpatialStore(state => state.updateFurniturePosition)
  const setIsDraggingFurniture = useSpatialStore(state => state.setIsDraggingFurniture)
  
  const [isDragging, setIsDragging] = useState(false)
  const { camera, gl } = useThree()
  
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  
  // Track offset so object doesn't teleport to the mouse
  const dragOffset = useRef<THREE.Vector3>(new THREE.Vector3())
  const isActuallyDragging = useRef(false)
  
  // Manual click tracking to beat browser race conditions
  const clickCount = useRef(0)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Ref to the group to update visually without waiting for React state
  const groupRef = useRef<THREE.Group>(null!)

  const bind = useDrag(({ active, first, last, event, movement: [mx, my], memo }) => {
    // We only care about left clicks or touch gestures
    // @ts-ignore
    if (event?.button !== undefined && event.button !== 0) return memo

    if (first && event) {
      setIsDraggingFurniture(true)
      isActuallyDragging.current = false
      
      // Calculate where on the floor the mouse is pointing
      const rect = gl.domElement.getBoundingClientRect()
      // @ts-ignore
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      // @ts-ignore
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      const intersection = new THREE.Vector3()
      raycaster.ray.intersectPlane(plane, intersection)
      
      // Calculate offset from object center to intersection point
      if (groupRef.current && intersection) {
        dragOffset.current.copy(groupRef.current.position).sub(intersection)
      }
      
      return intersection // Save to memo
    }

    if (active && event && memo) {
      // If the mouse has moved more than 3 pixels, it's a real drag
      if (Math.abs(mx) > 3 || Math.abs(my) > 3) {
        isActuallyDragging.current = true
        setIsDragging(true)
        document.body.style.cursor = 'grabbing'
        
        const rect = gl.domElement.getBoundingClientRect()
        // @ts-ignore
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        // @ts-ignore
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
        const intersection = new THREE.Vector3()
        raycaster.ray.intersectPlane(plane, intersection)
        
        if (intersection && groupRef.current) {
          // Add offset back to keep object relative to mouse
          const newPos = intersection.add(dragOffset.current)
          
          // Snap to 1-unit grid
          const snapX = Math.round(newPos.x)
          const snapZ = Math.round(newPos.z)
          
          groupRef.current.position.set(snapX, newPos.y, snapZ)
        }
      }
    }

    if (last) {
      setIsDraggingFurniture(false)
      setIsDragging(false)
      document.body.style.cursor = 'auto'
      
      if (isActuallyDragging.current && groupRef.current) {
        // Save final position to store
        updatePosition(id, [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z])
      } else {
        // It was a click, not a drag! Handle click logic manually.
        // @ts-ignore
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
        
        clickCount.current += 1
        
        if (clickCount.current === 1) {
          clickTimer.current = setTimeout(() => {
            clickCount.current = 0
            if (onSingleClick) onSingleClick()
          }, 250)
        } else if (clickCount.current === 2) {
          if (clickTimer.current) clearTimeout(clickTimer.current)
          clickCount.current = 0
          if (onDoubleClick) onDoubleClick()
        }
      }
    }
    
    return memo
  })

  return { bind, groupRef, isDragging }
}
