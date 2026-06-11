import { useState, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useDrag } from '@use-gesture/react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'

interface DrawerProps {
  position: [number, number, number]
  size: [number, number, number]
  isOpen: boolean
  onClick: (e: any) => void
}

function Drawer({ position, size, isOpen, onClick }: DrawerProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Smooth sliding animation
  useFrame((_, delta) => {
    if (groupRef.current) {
      // If open, slide out by 80% of its depth. If closed, protrude just 0.1 so it's visible.
      const targetZ = isOpen ? size[2] * 0.8 : 0.1
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetZ,
        10 * delta
      )
    }
  })

  return (
    <group position={position} ref={groupRef}>
      <mesh onClick={onClick}>
        <boxGeometry args={size} />
        <meshBasicMaterial color="#1e293b" /> {/* Slate 800 - clearly visible drawer */}
        <Edges scale={1.0} color={isOpen ? "#3b82f6" : "#cbd5e1"} />
      </mesh>
      
      {/* Drawer Handle */}
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
  const updatePosition = useSpatialStore(state => state.updateFurniturePosition)
  const setIsDraggingFurniture = useSpatialStore(state => state.setIsDraggingFurniture)
  
  const [isDragging, setIsDragging] = useState(false)
  const [openDrawerIndex, setOpenDrawerIndex] = useState<number | null>(null)
  
  const { camera, gl } = useThree()

  if (!furnitureData) return null

  // Extract dimensions from the global store so the cabinet stretches dynamically
  const [width, height, depth] = furnitureData.dimensions

  // Dynamically calculate drawer heights so they always fit perfectly inside the frame
  // We subtract 0.6 total for top/bottom margins and spacing
  const drawerHeight = (height - 0.6) / 4 

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  const bind = useDrag(({ active, first, last, event }) => {
    if (first) {
      setIsDragging(true)
      setIsDraggingFurniture(true)
      document.body.style.cursor = 'grabbing'
      // @ts-ignore
      event?.stopPropagation()
    }
    
    if (active && event) {
      const rect = gl.domElement.getBoundingClientRect()
      // @ts-ignore
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      // @ts-ignore
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      
      const target = new THREE.Vector3()
      raycaster.ray.intersectPlane(plane, target)

      if (target) {
        const snapX = Math.round(target.x)
        const snapZ = Math.round(target.z)
        updatePosition(id, [snapX, 0, snapZ])
      }
    }

    if (last) {
      setIsDragging(false)
      setIsDraggingFurniture(false)
      document.body.style.cursor = 'auto'
    }
  })

  const handleDrawerClick = (e: any, index: number) => {
    e.stopPropagation() 
    if (!isDragging) {
      setOpenDrawerIndex(prev => prev === index ? null : index)
    }
  }

  return (
    // @ts-ignore
    <group position={furnitureData.position}>
      
      {/* Invisible Drag Hitbox */}
      {/* @ts-ignore */}
      <mesh position={[0, height / 2, 0]} {...bind()} visible={false} onClick={(e) => { e.stopPropagation(); useSpatialStore.getState().focusFurniture(id); }}>
        <boxGeometry args={[width, height, depth]} />
      </mesh>

      {/* Main Cabinet Frame */}
      <mesh position={[0, height / 2, -0.1]}>
        <boxGeometry args={[width + 0.2, height + 0.2, depth]} />
        <meshBasicMaterial color="#0f172a" /> {/* Slate 900 - Darker frame */}
        <Edges scale={1.0} color={isDragging ? "#3b82f6" : "#ffffff"} />
      </mesh>

      {/* 4 Interactive Drawers */}
      {[0, 1, 2, 3].map((index) => {
        const yPos = (drawerHeight / 2) + 0.3 + (index * (drawerHeight + 0.2))
        return (
          <Drawer
            key={index}
            position={[0, yPos, 0]}
            size={[width - 0.2, drawerHeight, depth - 0.2]}
            isOpen={openDrawerIndex === index}
            onClick={(e) => handleDrawerClick(e, index)}
          />
        )
      })}
    </group>
  )
}

