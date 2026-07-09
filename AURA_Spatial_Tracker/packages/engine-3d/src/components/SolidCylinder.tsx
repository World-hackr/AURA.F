import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { defaultHologramPalette as holo, useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'

interface SolidCylinderProps {
  id: string
  isReference?: boolean
}

export function SolidCylinder({ id, isReference = false }: SolidCylinderProps) {
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

  // dimensions: [radius, height, 0 (unused)]
  const [radius, height] = useMemo(() => {
    const dims = furnitureData.dimensions || [1, 10]
    const r = typeof dims[0] === 'number' && !isNaN(dims[0]) ? Math.max(0.01, dims[0]) : 1
    const h = typeof dims[1] === 'number' && !isNaN(dims[1]) ? Math.max(0.01, dims[1]) : 10
    return [r, h]
  }, [furnitureData.dimensions])

  const material = assetDefinitions[furnitureData.modelId]?.materials?.[0]
  const opacity = isReference ? 0.05 : (material?.opacity ?? 0.15)
  const edgeOpacity = isReference ? 0.15 : 0.9

  return (
    <group 
      position={furnitureData.position} 
      rotation={[0, furnitureData.rotation || 0, 0]} 
      name={`furniture-${id}`} 
      ref={groupRef}
      raycast={isReference ? () => null : undefined}
    >
      <mesh 
        position={[0, height / 2, 0]} 
        onPointerDown={isReference ? undefined : onPointerDown}
        onPointerUp={isReference ? undefined : onPointerUp}
      >
        <cylinderGeometry args={[radius, radius, height, 32]} />
        <meshBasicMaterial color={material?.color ?? holo.buildingFill} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
        <Edges scale={1.0} color={isFocused ? holo.selectionEdge : holo.buildingEdge} lineWidth={2} opacity={edgeOpacity} />
      </mesh>
    </group>
  )
}
