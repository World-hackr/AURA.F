import { useState } from 'react'
import { useThree } from '@react-three/fiber'
import { useDrag } from '@use-gesture/react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { useSpatialStore } from '@aura/state-store'

interface WireframeBookshelfProps {
  id: string
}

export function WireframeBookshelf({ id }: WireframeBookshelfProps) {
  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const updatePosition = useSpatialStore(state => state.updateFurniturePosition)
  const setIsDraggingFurniture = useSpatialStore(state => state.setIsDraggingFurniture)
  
  const [isDragging, setIsDragging] = useState(false)
  const { size, camera } = useThree()

  if (!furnitureData) return null

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  const bind = useDrag(({ active, movement: [mx, my], first, last, event }) => {
    if (first) {
      setIsDragging(true)
      setIsDraggingFurniture(true) // Disable camera
      document.body.style.cursor = 'grabbing'
      // @ts-ignore
      event?.stopPropagation()
    }
    
    if (active && event) {
      // @ts-ignore
      const x = (event.clientX / size.width) * 2 - 1
      // @ts-ignore
      const y = -(event.clientY / size.height) * 2 + 1

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
      setIsDraggingFurniture(false) // Enable camera
      document.body.style.cursor = 'auto'
    }
  })

  return (
    // @ts-ignore
    <group position={furnitureData.position} {...bind()}>
      {/* Main Body */}
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[8, 6, 1.5]} />
        <meshBasicMaterial color="#0b0f19" transparent opacity={0.9} />
        <Edges scale={1.0} threshold={15} color={isDragging ? "#3b82f6" : "#64748b"} />
      </mesh>
      
      {/* Shelves */}
      {[1, 2, 3, 4, 5].map((yOffset) => (
        <mesh key={yOffset} position={[0, yOffset, 0]}>
           <boxGeometry args={[7.9, 0.05, 1.4]} />
           <meshBasicMaterial color="#0b0f19" />
           <Edges scale={1.0} color={isDragging ? "#3b82f6" : "#64748b"} />
        </mesh>
      ))}
    </group>
  )
}
