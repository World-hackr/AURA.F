import { useRef } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { defaultHologramPalette as holo, useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'

interface IBeamProps {
  id: string
}

export function IBeam({ id }: IBeamProps) {
  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)
  const isFocused = useSpatialStore(state => state.focusedFurnitureId === id)
  const doubleClickDelay = useSpatialStore(state => state.doubleClickDelay)
  const material = useSpatialStore(state => state.assetDefinitions['i-beam']?.materials[0])

  const groupRef = useRef<THREE.Group>(null!)

  const { onPointerDown, onPointerUp } = useRawPointerInteraction({
    onSingleClick: () => focusFurniture(id),
    onDoubleClick: () => setCameraTarget(id),
    doubleClickDelay
  })

  if (!furnitureData) return null

  const [length, height, width] = furnitureData.dimensions

  // I-Beam proportions
  const flangeHeight = height * 0.1
  const webWidth = width * 0.2
  const color = material?.color ?? '#ef4444'
  const opacity = material?.opacity ?? 0.2

  return (
    <group position={furnitureData.position} rotation={[0, furnitureData.rotation, 0]} name={`furniture-${id}`} ref={groupRef}>
      <group position={[0, height / 2, 0]} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        
        {/* Bottom Flange */}
        <mesh position={[0, -height / 2 + flangeHeight / 2, 0]}>
          <boxGeometry args={[length, flangeHeight, width]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          <Edges scale={1.0} color={isFocused ? holo.selectionEdge : holo.furnitureEdge} lineWidth={1.8} />
        </mesh>

        {/* Vertical Web */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[length, height - (flangeHeight * 2), webWidth]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          <Edges scale={1.0} color={isFocused ? holo.selectionEdge : holo.furnitureEdge} lineWidth={1.8} />
        </mesh>

        {/* Top Flange */}
        <mesh position={[0, height / 2 - flangeHeight / 2, 0]}>
          <boxGeometry args={[length, flangeHeight, width]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          <Edges scale={1.0} color={isFocused ? holo.selectionEdge : holo.furnitureEdge} lineWidth={1.8} />
        </mesh>

      </group>
    </group>
  )
}
