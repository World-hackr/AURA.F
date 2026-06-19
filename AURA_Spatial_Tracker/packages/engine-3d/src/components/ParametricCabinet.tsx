import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { defaultHologramPalette as holo, useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'
import { BoxOutline } from './BoxOutline'

interface DrawerProps {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  opacity: number
  edgeColor: string
  isOpen: boolean
  onSingleClick: () => void
  onDoubleClick: () => void
  doubleClickDelay: number
}

function Drawer({ position, size, color, opacity, edgeColor, isOpen, onSingleClick, onDoubleClick, doubleClickDelay }: DrawerProps) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      const targetZ = isOpen ? size[2] * 0.8 : 0.1
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetZ,
        10 * delta
      )
    }
  })

  const { onPointerDown, onPointerUp } = useRawPointerInteraction({
    onSingleClick,
    onDoubleClick,
    doubleClickDelay
  })

  return (
    <group position={position} ref={groupRef}>
      <mesh onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        <BoxOutline size={size} color={isOpen ? holo.selectionEdge : edgeColor} />
      </mesh>
      <mesh position={[0, 0, size[2] / 2 + 0.05]}>
        <boxGeometry args={[size[0] * 0.3, 0.1, 0.1]} />
        <meshBasicMaterial color={holo.itemEdge} transparent opacity={0.88} depthWrite={false} />
        <BoxOutline size={[size[0] * 0.3, 0.1, 0.1]} color={holo.selectionEdge} opacity={0.85} />
      </mesh>
    </group>
  )
}

interface ParametricCabinetProps {
  id: string
}

export function ParametricCabinet({ id }: ParametricCabinetProps) {
  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)
  const isFocused = useSpatialStore(state => state.focusedFurnitureId === id)
  const doubleClickDelay = useSpatialStore(state => state.doubleClickDelay)
  const assetDefinition = useSpatialStore(state => state.assetDefinitions.parametric)

  const [openDrawerIndex, setOpenDrawerIndex] = useState<number | null>(null)

  if (!furnitureData) return null

  // Enforce strict minimums so WebGL never crashes with negative geometry
  const width = Math.max(0.5, furnitureData.dimensions[0])
  const height = Math.max(1.5, furnitureData.dimensions[1]) // Must be at least 1.5 to hold 4 drawers
  const depth = Math.max(0.5, furnitureData.dimensions[2])
  
  const drawerHeight = Math.max(0.1, (height - 1.0) / 4) 
  const shellMaterial = assetDefinition?.materials.find(material => material.target === 'shell')
  const shellOpacity = shellMaterial?.opacity ?? 1

  const { onPointerDown: frameDown, onPointerUp: frameUp } = useRawPointerInteraction({
    onSingleClick: () => focusFurniture(id),
    onDoubleClick: () => setCameraTarget(id),
    doubleClickDelay
  })

  return (
    <group 
      position={furnitureData.position} 
      rotation={[0, furnitureData.rotation || 0, 0]} 
      name={`furniture-${id}`}
    >
      <mesh 
        position={[0, height / 2, -0.1]} 
        onPointerDown={frameDown}
        onPointerUp={frameUp}
      >
        <boxGeometry args={[width + 0.2, height + 0.2, depth]} />
        <meshBasicMaterial color={shellMaterial?.color ?? holo.furnitureFill} transparent opacity={shellOpacity} depthWrite={false} />
        <BoxOutline size={[width + 0.2, height + 0.2, depth]} color={isFocused ? holo.selectionEdge : holo.furnitureEdge} />
      </mesh>

      {/* 4 Interactive Drawers */}
      {[0, 1, 2, 3].map((index) => {
        const yPos = (drawerHeight / 2) + 0.2 + (index * (drawerHeight + 0.2))
        const drawerMaterial = assetDefinition?.materials.find(material => material.target === `drawer-${index + 1}`)
        const drawerOpacity = drawerMaterial?.opacity ?? 0.38
        return (
          <Drawer
            key={index}
            position={[0, yPos, 0]}
            size={[Math.max(0.1, width - 0.2), drawerHeight, Math.max(0.1, depth - 0.2)]}
            color={drawerMaterial?.color ?? holo.innerFill}
            opacity={drawerOpacity}
            edgeColor={holo.innerEdge}
            isOpen={openDrawerIndex === index}
            onSingleClick={() => {
              setOpenDrawerIndex((prev: number | null) => prev === index ? null : index)
              focusFurniture(id)
            }}
            onDoubleClick={() => setCameraTarget(id)}
            doubleClickDelay={doubleClickDelay}
          />
        )
      })}
    </group>
  )
}

