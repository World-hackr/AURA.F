import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'

interface DrawerProps {
  position: [number, number, number]
  size: [number, number, number]
  isOpen: boolean
  onSingleClick: () => void
  onDoubleClick: () => void
  doubleClickDelay: number
}

function Drawer({ position, size, isOpen, onSingleClick, onDoubleClick, doubleClickDelay }: DrawerProps) {
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
        <meshBasicMaterial color="#1e293b" />
        <Edges scale={1.0} color={isOpen ? "#3b82f6" : "#cbd5e1"} />
      </mesh>
      <mesh position={[0, 0, size[2] / 2 + 0.05]}>
        <boxGeometry args={[size[0] * 0.3, 0.1, 0.1]} />
        <meshBasicMaterial color="#f8fafc" />
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

  const [openDrawerIndex, setOpenDrawerIndex] = useState<number | null>(null)

  if (!furnitureData) return null

  const [width, height, depth] = furnitureData.dimensions
  const drawerHeight = (height - 1.0) / 4 

  const { onPointerDown: frameDown, onPointerUp: frameUp } = useRawPointerInteraction({
    onSingleClick: () => focusFurniture(id),
    onDoubleClick: () => setCameraTarget(id),
    doubleClickDelay
  })

  return (
    <group position={furnitureData.position} name={`furniture-${id}`}>
      <mesh 
        position={[0, height / 2, -0.1]} 
        onPointerDown={frameDown}
        onPointerUp={frameUp}
      >
        <boxGeometry args={[width + 0.2, height + 0.2, depth]} />
        <meshBasicMaterial color="#0f172a" />
        <Edges scale={1.0} color={isFocused ? "#3b82f6" : "#ffffff"} />
      </mesh>

      {/* 4 Interactive Drawers */}
      {[0, 1, 2, 3].map((index) => {
        const yPos = (drawerHeight / 2) + 0.2 + (index * (drawerHeight + 0.2))
        return (
          <Drawer
            key={index}
            position={[0, yPos, 0]}
            size={[width - 0.2, drawerHeight, depth - 0.2]}
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

