import { useState, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { useDrag } from '@use-gesture/react'
import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { useSpatialStore } from '@aura/state-store'

interface LoadedShelfProps {
  id: string
}

export function LoadedShelf({ id }: LoadedShelfProps) {
  // Load the OBJ file from the public folder
  const obj = useLoader(OBJLoader, '/models/shelf.obj')
  
  // Clone it so we can have multiple shelves without them sharing exactly the same reference
  const clonedObj = useMemo(() => obj.clone(), [obj])

  // Apply a custom, clean, textureless material to all parts of the downloaded model
  useMemo(() => {
    clonedObj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Flat dark material matching our aesthetic, stripping out any heavy textures
        child.material = new THREE.MeshStandardMaterial({
          color: '#1e293b', 
          roughness: 0.8,
          metalness: 0.2
        })
      }
    })
  }, [clonedObj])

  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const updatePosition = useSpatialStore(state => state.updateFurniturePosition)
  const setIsDraggingFurniture = useSpatialStore(state => state.setIsDraggingFurniture)
  
  const [isDragging, setIsDragging] = useState(false)
  const { camera, gl } = useThree()

  if (!furnitureData) return null

  // Read dimensions from the store (default is usually [4, 6, 2])
  // We use this to scale the static 3D model
  const [w, h, d] = furnitureData.dimensions

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

  // The base scale multiplier for this specific downloaded model to make it look normal size
  const baseScale = 0.02

  return (
    // @ts-ignore
    <group position={furnitureData.position} {...bind()}>
      {/* 
        We multiply the base scale by the UI dimensions.
        This allows the static .obj file to be stretched and squished by the user!
      */}
      <primitive 
        object={clonedObj} 
        scale={[baseScale * w, baseScale * h, baseScale * d]} 
        position={[0, 0, 0]} 
      />
      
      {/* Invisible Box for easier grabbing. We scale this to match the UI dimensions too. */}
      {/* @ts-ignore */}
      <mesh visible={false} position={[0, h/2, 0]} onClick={(e) => { e.stopPropagation(); useSpatialStore.getState().focusFurniture(id); }}>
         <boxGeometry args={[w, h, d]} />
      </mesh>
    </group>
  )
}
