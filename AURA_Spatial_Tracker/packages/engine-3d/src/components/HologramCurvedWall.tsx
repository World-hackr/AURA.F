import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { defaultHologramPalette as holo, useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'

interface HologramCurvedWallProps {
  id: string
  isReference?: boolean
}

export function HologramCurvedWall({ id, isReference = false }: HologramCurvedWallProps) {
  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)
  const isFocused = useSpatialStore(state => state.focusedFurnitureId === id)
  const doubleClickDelay = useSpatialStore(state => state.doubleClickDelay)
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions)

  const groupRef = useRef<THREE.Group>(null!)

  const { onPointerDown, onPointerUp } = useRawPointerInteraction({
    onSingleClick: () => focusFurniture(id),
    onDoubleClick: () => setCameraTarget(id),
    doubleClickDelay
  })

  if (!furnitureData) return null

  // dimensions: [radius, height, thickness]
  const [radius, height, thickness] = useMemo(() => {
    const dims = furnitureData.dimensions || [1, 10, 0.375]
    const r = typeof dims[0] === 'number' && !isNaN(dims[0]) ? Math.max(0.01, dims[0]) : 1
    const h = typeof dims[1] === 'number' && !isNaN(dims[1]) ? Math.max(0.01, dims[1]) : 10
    const t = typeof dims[2] === 'number' && !isNaN(dims[2]) ? Math.max(0.01, dims[2]) : 0.375
    return [r, h, t]
  }, [furnitureData.dimensions])

  const material = assetDefinitions[furnitureData.modelId]?.materials[0]
  const opacity = isReference ? 0.05 : (material?.opacity ?? 0.1)
  const edgeOpacity = isReference ? 0.15 : 0.9

  // Create a 2D ring shape and extrude it
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    const outerR = radius + thickness / 2
    const innerR = Math.max(0.01, radius - thickness / 2) // avoid non-positive radius
    
    // Outer boundary (Counter-clockwise)
    s.absarc(0, 0, outerR, 0, Math.PI * 2, false)
    
    // Inner boundary (Clockwise to subtract it)
    const hole = new THREE.Path()
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true)
    s.holes.push(hole)
    
    return s
  }, [radius, thickness])

  const extrudeSettings = useMemo(() => ({
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 64, // high segment count for perfectly smooth silhouette
  }), [height])

  return (
    <group 
      position={furnitureData.position} 
      rotation={[0, furnitureData.rotation, 0]} 
      name={`furniture-${id}`} 
      ref={groupRef}
      raycast={isReference ? () => null : undefined}
    >
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={isReference ? undefined : onPointerDown}
        onPointerUp={isReference ? undefined : onPointerUp}
      >
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshBasicMaterial 
          color={material?.color ?? holo.buildingFill} 
          transparent 
          opacity={opacity} 
          depthWrite={false} 
          side={THREE.DoubleSide} 
        />
        <Edges scale={1.0} color={isFocused ? holo.selectionEdge : holo.buildingEdge} lineWidth={2} opacity={edgeOpacity} />
      </mesh>
    </group>
  )
}
