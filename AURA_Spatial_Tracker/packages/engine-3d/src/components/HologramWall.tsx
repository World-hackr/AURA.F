import { useRef } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { defaultHologramPalette as holo, useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'

interface HologramWallProps {
  id: string
}

export function HologramWall({ id }: HologramWallProps) {
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

  const [width, height, depth] = furnitureData.dimensions
  const material = assetDefinitions[furnitureData.modelId]?.materials[0]
  const opacity = material?.opacity ?? 0.1

  return (
    <group position={furnitureData.position} rotation={[0, furnitureData.rotation, 0]} name={`furniture-${id}`} ref={groupRef}>
      <mesh 
        position={[0, height / 2, 0]} 
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <boxGeometry args={[width, height, depth]} />
        {/* Hologram aesthetic: Highly transparent with glowing edges */}
        <meshBasicMaterial color={material?.color ?? holo.buildingFill} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
        <Edges scale={1.0} color={isFocused ? holo.selectionEdge : holo.buildingEdge} lineWidth={2} />
      </mesh>
    </group>
  )
}
