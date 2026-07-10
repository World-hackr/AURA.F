import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface InfiniteGridHelperProps {
  size?: number
  divisions?: number
  color1?: string
  color2?: string
  gridStep?: number
}

export function InfiniteGridHelper({
  size = 400,
  divisions = 400,
  color1 = '#111827',
  color2 = '#1f2937',
  gridStep = 1.0
}: InfiniteGridHelperProps) {
  const gridRef = useRef<THREE.GridHelper>(null)
  const { camera, controls } = useThree()

  useFrame(() => {
    if (!gridRef.current) return

    const target = new THREE.Vector3()

    // Retrieve active camera controls target or fallback to camera frustum intersection
    if (controls && typeof (controls as any).getTarget === 'function') {
      ;(controls as any).getTarget(target)
    } else {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      if (Math.abs(dir.y) > 0.0001) {
        const t = -camera.position.y / dir.y
        target.copy(camera.position).addScaledVector(dir, t)
      } else {
        target.copy(camera.position)
      }
    }

    // Snap the grid origin to standard increments to make the transition invisible
    const snapX = Math.round(target.x / gridStep) * gridStep
    const snapZ = Math.round(target.z / gridStep) * gridStep

    gridRef.current.position.set(snapX, -0.01, snapZ)
  })

  return (
    <gridHelper
      ref={gridRef}
      args={[size, divisions, color1, color2]}
      position={[0, -0.01, 0]}
    />
  )
}
