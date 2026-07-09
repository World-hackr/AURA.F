import { useEffect, useMemo, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import {
  type AuraAssetDefinition,
  createAssetObjectUrl,
  defaultHologramPalette as holo,
  hologramOpacity,
  useSpatialStore,
} from '@aura/state-store'
import { useRawPointerInteraction } from '../hooks/useRawPointerInteraction'
import { BoxOutline } from './BoxOutline'

interface ImportedAssetFurnitureProps {
  id: string
}

const MIN_IMPORTED_OPACITY = 0.08

function applyAssetRoles(scene: THREE.Object3D, asset: AuraAssetDefinition) {
  const defaultMaterialDef = asset.materials.find(m => m.target === 'all' || m.target === 'shell');
  const defaultColor = defaultMaterialDef?.color ?? holo.furnitureFill;
  const defaultOpacity = Math.max(MIN_IMPORTED_OPACITY, defaultMaterialDef?.opacity ?? hologramOpacity.furnitureFill);

  const defaultMaterial = new THREE.MeshBasicMaterial({
    color: defaultColor,
    transparent: true,
    opacity: defaultOpacity,
    depthWrite: false,
  });

  const partMap = new Map(asset.parts.map(p => [p.meshName, p]));
  const materialMap = new Map(asset.materials.map(m => [m.target, m]));

  // We cache created materials so we don't spam WebGL
  const instantiatedMaterials = new Map<string, THREE.Material>();
  instantiatedMaterials.set('default', defaultMaterial);

  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      let current: THREE.Object3D | null = object;
      let matchedPart = null;
      
      while (current) {
        if (current.name && partMap.has(current.name)) {
          matchedPart = partMap.get(current.name)!;
          break;
        }
        current = current.parent;
      }

      if (matchedPart) {
        const matDef = materialMap.get(matchedPart.id) || materialMap.get(matchedPart.name);
        if (matDef) {
          if (!instantiatedMaterials.has(matDef.id)) {
            instantiatedMaterials.set(matDef.id, new THREE.MeshBasicMaterial({
              color: matDef.color,
              transparent: true,
              opacity: Math.max(MIN_IMPORTED_OPACITY, matDef.opacity),
              depthWrite: false,
            }));
          }
          object.material = instantiatedMaterials.get(matDef.id)!;
        } else {
          if (!instantiatedMaterials.has('part-fallback')) {
            instantiatedMaterials.set('part-fallback', new THREE.MeshBasicMaterial({
              color: holo.innerFill,
              transparent: true,
              opacity: hologramOpacity.innerFill,
              depthWrite: false,
            }));
          }
          object.material = instantiatedMaterials.get('part-fallback')!;
        }
      } else {
        object.material = defaultMaterial;
      }
    }
  });

  // Apply visual offsets for Parts that are configured
  // For the room view, we will eventually animate these. 
  // For now, if a part is "slide" or "rotate", we reset it to its defined closed offset.
  asset.parts.forEach(part => {
    if (!part.meshName) return;
    const node = scene.getObjectByName(part.meshName);
    if (!node) return;

    if (part.motion === 'slide') {
      // Local translation along defined axis
      // Reset position first if we want pure programmatic control, 
      // but usually the model's base transform IS the closed state.
      // We will leave position untouched for now to avoid breaking the model's resting state.
    }
  });
}

function ImportedGltfModel({ asset, modelUrl }: { asset: AuraAssetDefinition, modelUrl: string }) {
  const gltf = useLoader(GLTFLoader, modelUrl)

  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true)
    applyAssetRoles(clone, asset)
    return clone
  }, [asset, gltf.scene])

  return <primitive object={scene} />
}

function ImportedObjectModel({
  asset,
  modelUrl,
  loader,
}: {
  asset: AuraAssetDefinition
  modelUrl: string
  loader: typeof FBXLoader | typeof OBJLoader
}) {
  const object = useLoader(loader, modelUrl)

  const scene = useMemo(() => {
    const clone = object.clone(true)
    applyAssetRoles(clone, asset)
    return clone
  }, [asset, object])

  return <primitive object={scene} />
}

function ImportedStlModel({ asset, modelUrl }: { asset: AuraAssetDefinition, modelUrl: string }) {
  const geometry = useLoader(STLLoader, modelUrl)
  
  const material = useMemo(() => {
    const def = asset.materials[0];
    return new THREE.MeshBasicMaterial({ 
      color: def?.color ?? holo.furnitureFill, 
      transparent: true, 
      opacity: Math.max(MIN_IMPORTED_OPACITY, def?.opacity ?? hologramOpacity.furnitureFill), 
      depthWrite: false 
    });
  }, [asset]);

  return (
    <mesh material={material}>
      <primitive attach="geometry" object={geometry} />
    </mesh>
  )
}

export function ImportedModel({
  asset,
  modelUrl,
  dimensions,
}: {
  asset: AuraAssetDefinition
  modelUrl: string
  dimensions: [number, number, number]
}) {
  const unitScale = asset.sourceUnitScale ?? 1
  const offset = asset.sourceModelOffset ?? ([0, 0, 0] as [number, number, number])

  // Scale the model dynamically if instance dimensions differ from calibrated default dimensions
  const [w_inst, h_inst, d_inst] = dimensions
  const [w_def, h_def, d_def] = asset.defaultDimensions
  const scaleX = (w_def > 0 ? w_inst / w_def : 1) * unitScale
  const scaleY = (h_def > 0 ? h_inst / h_def : 1) * unitScale
  const scaleZ = (d_def > 0 ? d_inst / d_def : 1) * unitScale

  const model =
    asset.supportedFileType === 'fbx' ? (
      <ImportedObjectModel asset={asset} modelUrl={modelUrl} loader={FBXLoader} />
    ) : asset.supportedFileType === 'obj' ? (
      <ImportedObjectModel asset={asset} modelUrl={modelUrl} loader={OBJLoader} />
    ) : asset.supportedFileType === 'stl' ? (
      <ImportedStlModel asset={asset} modelUrl={modelUrl} />
    ) : (
      <ImportedGltfModel asset={asset} modelUrl={modelUrl} />
    )

  return (
    <group position={offset} scale={[scaleX, scaleY, scaleZ]}>
      {model}
    </group>
  )
}

export function ImportedAssetFurniture({ id }: ImportedAssetFurnitureProps) {
  const furnitureData = useSpatialStore(state => state.furniture.find(f => f.id === id))
  const focusFurniture = useSpatialStore(state => state.focusFurniture)
  const setCameraTarget = useSpatialStore(state => state.setCameraTarget)
  const isFocused = useSpatialStore(state => state.focusedFurnitureId === id)
  const doubleClickDelay = useSpatialStore(state => state.doubleClickDelay)
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions)
  const [modelUrl, setModelUrl] = useState<string | null>(null)

  const { onPointerDown, onPointerUp } = useRawPointerInteraction({
    onSingleClick: () => focusFurniture(id),
    onDoubleClick: () => setCameraTarget(id),
    doubleClickDelay,
  })

  const asset = furnitureData ? assetDefinitions[furnitureData.modelId] : undefined

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    const loadModelUrl = async () => {
      if (!asset?.sourceStorageKey) {
        setModelUrl(null)
        return
      }

      objectUrl = await createAssetObjectUrl(asset.sourceStorageKey)
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        return
      }

      setModelUrl(objectUrl)
    }

    void loadModelUrl()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [asset?.sourceStorageKey])

  if (!furnitureData || !asset) return null

  const material = asset.materials[0]
  const color = material?.color ?? holo.furnitureFill
  const opacity = Math.max(MIN_IMPORTED_OPACITY, material?.opacity ?? hologramOpacity.furnitureFill)
  const [width, height, depth] = furnitureData.dimensions

  return (
    <group
      position={furnitureData.position}
      rotation={[0, furnitureData.rotation || 0, 0]}
      name={`furniture-${id}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {modelUrl ? (
        <ImportedModel asset={asset} modelUrl={modelUrl} dimensions={[width, height, depth]} />
      ) : (
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, height / 2, 0]}>
        <BoxOutline size={[width, height, depth]} color={isFocused ? holo.selectionEdge : holo.furnitureEdge} opacity={0.92} />
      </mesh>
    </group>
  )
}
