import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { ArrowLeft, Search, Upload } from 'lucide-react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import {
  createAssetFileKey,
  createAssetObjectUrl,
  defaultHologramPalette as holo,
  hologramOpacity,
  saveAssetFile,
  useSpatialStore,
  type AuraAssetDefinition,
} from '@aura/state-store'
import { BoxOutline, createLowPolyFurnitureParts } from '@aura/engine-3d'
import { AssetEditor } from './UIPanels'

type AssetWorkspaceProps = {
  onClose: () => void
}

const round = (value: number) => Math.round(value * 1000) / 1000
type SupportedImportType = NonNullable<AuraAssetDefinition['supportedFileType']>
const supportedImportTypes = ['glb', 'gltf', 'fbx', 'obj', 'stl'] as const
const MILLIMETERS_TO_FEET = 1 / 304.8
const MIN_IMPORTED_OPACITY = 0.08

const isSupportedImportType = (extension: string | undefined): extension is SupportedImportType =>
  Boolean(extension && (supportedImportTypes as readonly string[]).includes(extension))

const sanitizeAssetId = (name: string) =>
  name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'imported-asset'

async function loadImportedObject(url: string, extension: SupportedImportType): Promise<THREE.Object3D> {
  if (extension === 'glb' || extension === 'gltf') {
    const gltf = await new GLTFLoader().loadAsync(url)
    return gltf.scene
  }

  if (extension === 'fbx') {
    return new FBXLoader().loadAsync(url)
  }

  if (extension === 'obj') {
    return new OBJLoader().loadAsync(url)
  }

  const geometry = await new STLLoader().loadAsync(url)
  geometry.computeVertexNormals()
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
}

function getImportUnitScale(size: THREE.Vector3, extension: SupportedImportType) {
  const largestSide = Math.max(size.x, size.y, size.z)

  if ((extension === 'fbx' || extension === 'stl' || extension === 'obj') && largestSide > 30) {
    return MILLIMETERS_TO_FEET
  }

  return 1
}

export function AssetWorkspace({ onClose }: AssetWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [runtimeModelUrls, setRuntimeModelUrls] = useState<Record<string, string>>({})
  const runtimeModelUrlsRef = useRef<Record<string, string>>({})
  const managedObjectUrlsRef = useRef<string[]>([])
  const importedAssetSourcesRef = useRef<Array<{ id: string, sourceStorageKey: string }>>([])
  const assetDefinitions = useSpatialStore(state => state.assetDefinitions)
  const selectedAssetDefinitionId = useSpatialStore(state => state.selectedAssetDefinitionId)
  const setSelectedAssetDefinitionId = useSpatialStore(state => state.setSelectedAssetDefinitionId)
  const upsertAssetDefinition = useSpatialStore(state => state.upsertAssetDefinition)

  const assets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return Object.values(assetDefinitions).filter(asset =>
      !normalizedQuery ||
      asset.displayName.toLowerCase().includes(normalizedQuery) ||
      asset.id.toLowerCase().includes(normalizedQuery)
    )
  }, [assetDefinitions, query])

  const selectedAsset = assetDefinitions[selectedAssetDefinitionId] ?? Object.values(assetDefinitions)[0]
  const selectedModelUrl = selectedAsset ? runtimeModelUrls[selectedAsset.id] : undefined
  const importedAssetSources = useMemo(
    () => Object.values(assetDefinitions)
      .filter((asset): asset is AuraAssetDefinition & { sourceStorageKey: string } => Boolean(asset.sourceStorageKey))
      .map(asset => ({ id: asset.id, sourceStorageKey: asset.sourceStorageKey })),
    [assetDefinitions]
  )
  const importedAssetSourceSignature = useMemo(
    () => importedAssetSources
      .map(asset => `${asset.id}:${asset.sourceStorageKey}`)
      .sort()
      .join('|'),
    [importedAssetSources]
  )

  useEffect(() => {
    runtimeModelUrlsRef.current = runtimeModelUrls
  }, [runtimeModelUrls])

  useEffect(() => {
    importedAssetSourcesRef.current = importedAssetSources
  }, [importedAssetSources])

  useEffect(() => () => {
    managedObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    managedObjectUrlsRef.current = []
  }, [])

  useEffect(() => {
    let cancelled = false

    const restoreModelUrls = async () => {
      const missingAssets = importedAssetSourcesRef.current.filter(asset => !runtimeModelUrlsRef.current[asset.id])
      if (missingAssets.length === 0) return

      const restoredEntries = await Promise.all(
        missingAssets.map(async asset => {
          const url = await createAssetObjectUrl(asset.sourceStorageKey)
          if (url) managedObjectUrlsRef.current.push(url)
          return url ? ([asset.id, url] as const) : null
        })
      )

      if (cancelled) {
        return
      }

      setRuntimeModelUrls(current => ({
        ...current,
        ...Object.fromEntries(restoredEntries.filter(Boolean) as Array<[string, string]>),
      }))
    }

    void restoreModelUrls()

    return () => {
      cancelled = true
    }
  }, [importedAssetSourceSignature])

  const importModel = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!isSupportedImportType(extension)) return

    const url = URL.createObjectURL(file)
    const importedObject = await loadImportedObject(url, extension)
    importedObject.updateMatrixWorld(true)

    const bounds = new THREE.Box3().setFromObject(importedObject)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    bounds.getSize(size)
    bounds.getCenter(center)
    const min = bounds.min.clone()
    const unitScale = getImportUnitScale(size, extension)
    const normalizedSize = size.clone().multiplyScalar(unitScale)
    const normalizedOffset: [number, number, number] = [
      round(-center.x * unitScale),
      round(-min.y * unitScale),
      round(-center.z * unitScale),
    ]

    const meshNodes: AuraAssetDefinition['meshNodes'] = []
    importedObject.traverse(object => {
      if (object.type === 'Group' || object.type === 'Object3D' || object.type === 'Mesh') {
        const name = object.name || object.uuid.slice(0, 8)
        meshNodes.push({
          id: object.uuid,
          name,
          type: object.type === 'Mesh' ? 'mesh' : 'group',
          parentName: object.parent?.name || undefined,
        })
      }
    })

    const assetIdBase = sanitizeAssetId(file.name)
    let assetId = assetIdBase
    let suffix = 2
    while (assetDefinitions[assetId]) {
      assetId = `${assetIdBase}-${suffix}`
      suffix += 1
    }

    const sourceStorageKey = createAssetFileKey(assetId, file.name)
    await saveAssetFile(sourceStorageKey, file)

    const dimensions: [number, number, number] = [
      Math.max(0.01, round(normalizedSize.x)),
      Math.max(0.01, round(normalizedSize.y)),
      Math.max(0.01, round(normalizedSize.z)),
    ]

    const asset: AuraAssetDefinition = {
      id: assetId,
      displayName: file.name.replace(/\.[^/.]+$/, ''),
      sourcePath: file.name,
      sourceStorageKey,
      sourceUnitScale: unitScale,
      sourceModelOffset: normalizedOffset,
      supportedFileType: extension,
      defaultDimensions: dimensions,
      footprint: {
        width: dimensions[0],
        depth: dimensions[2],
        offset: [0, 0],
      },
      collision: [
        {
          id: `${assetId}-bounds`,
          name: 'Auto Bounds',
          center: [0, round(dimensions[1] / 2), 0],
          size: dimensions,
        },
      ],
      snapPoints: [
        { id: `${assetId}-left-edge`, name: 'Left Edge', position: [round(-dimensions[0] / 2), 0, 0] },
        { id: `${assetId}-right-edge`, name: 'Right Edge', position: [round(dimensions[0] / 2), 0, 0] },
        { id: `${assetId}-front-edge`, name: 'Front Edge', position: [0, 0, round(dimensions[2] / 2)] },
        { id: `${assetId}-back-edge`, name: 'Back Edge', position: [0, 0, round(-dimensions[2] / 2)] },
      ],
      parts: [],
      materials: [
        { id: `${assetId}-material`, target: 'all', color: holo.furnitureFill, opacity: hologramOpacity.furnitureFill },
      ],
      meshNodes,
    }

    upsertAssetDefinition(asset)
    managedObjectUrlsRef.current.push(url)
    setRuntimeModelUrls(current => ({ ...current, [assetId]: url }))
  }

  return (
    <div className="asset-workspace">
      <aside className="asset-browser">
        <div className="asset-browser-header">
          <button className="action-btn" onClick={onClose}>
            <ArrowLeft size={16} /> Room
          </button>
          <strong>Assets</strong>
        </div>

        <label className="asset-import-button">
          <Upload size={16} />
          Import Model
          <input
            type="file"
            accept=".glb,.gltf,.fbx,.obj,.stl,model/gltf-binary,model/gltf+json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importModel(file)
              event.currentTarget.value = ''
            }}
          />
        </label>

        <div className="search-container">
          <Search size={16} />
          <input
            className="text-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search furniture..."
          />
        </div>

        <div className="asset-list">
          {assets.map(asset => (
            <button
              key={asset.id}
              className={`asset-list-item ${asset.id === selectedAsset.id ? 'active' : ''}`}
              onClick={() => setSelectedAssetDefinitionId(asset.id)}
            >
              <span>{asset.displayName}</span>
              <small>{asset.supportedFileType ?? 'generated'} - {asset.id}</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="asset-preview-panel">
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [7, 5, 7], fov: 45 }}
          gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        >
          <color attach="background" args={[holo.background]} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[8, 12, 8]} intensity={1.2} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
            <planeGeometry args={[40, 40]} />
            <meshBasicMaterial color="#020617" />
          </mesh>
          <gridHelper args={[40, 40, holo.grid, '#0f172a']} position={[0, 0, 0]} />
          <Suspense fallback={null}>
            {selectedAsset && <AssetPreview asset={selectedAsset} modelUrl={selectedModelUrl} />}
          </Suspense>
          <OrbitControls makeDefault target={[0, selectedAsset?.defaultDimensions[1] ? selectedAsset.defaultDimensions[1] / 2 : 1, 0]} />
        </Canvas>
      </main>

      <aside className="asset-tools">
        <div className="panel-header">Asset Calibrator</div>
        <div className="panel-content">
          <AssetEditor />
        </div>
      </aside>
    </div>
  )
}

function AssetPreview({ asset, modelUrl }: { asset: AuraAssetDefinition, modelUrl?: string }) {
  const [width, height, depth] = asset.defaultDimensions
  const primaryMaterial = asset.materials[0]
  const color = primaryMaterial?.color ?? '#1e293b'
  const opacity = primaryMaterial?.opacity ?? 1

  return (
    <group>
      {asset.id === 'parametric' ? (
        <CabinetPreview asset={asset} />
      ) : asset.id === 'i-beam' ? (
        <IBeamPreview asset={asset} />
      ) : asset.id.startsWith('low-') ? (
        <LowPolyAssetPreview asset={asset} />
      ) : modelUrl ? (
        <ImportedModelPreview asset={asset} modelUrl={modelUrl} />
      ) : (
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} roughness={0.8} />
          <BoxOutline size={[width, height, depth]} color={asset.id.startsWith('wall') ? holo.buildingEdge : holo.furnitureEdge} />
        </mesh>
      )}

      <FootprintPreview asset={asset} />
      <CollisionPreview asset={asset} />
      <SnapPointPreview asset={asset} />
    </group>
  )
}

function LowPolyAssetPreview({ asset }: { asset: AuraAssetDefinition }) {
  const material = asset.materials[0]
  const parts = useMemo(
    () => createLowPolyFurnitureParts(asset.id, asset.defaultDimensions),
    [asset.defaultDimensions, asset.id]
  )

  return (
    <group>
      {parts.map(item => {
        const color = item.role === 'inner' ? holo.innerFill : item.role === 'detail' ? holo.itemFill : material?.color ?? holo.furnitureFill
        const edge = item.role === 'inner' ? holo.innerEdge : item.role === 'detail' ? holo.itemEdge : holo.furnitureEdge

        return (
          <mesh key={item.name} position={item.position}>
            <boxGeometry args={item.size} />
            <meshBasicMaterial color={color} transparent opacity={material?.opacity ?? hologramOpacity.furnitureFill} depthWrite={false} />
            <BoxOutline size={item.size} color={edge} />
          </mesh>
        )
      })}
    </group>
  )
}

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
}

function ImportedGltfPreview({ asset, modelUrl }: { asset: AuraAssetDefinition, modelUrl: string }) {
  const gltf = useLoader(GLTFLoader, modelUrl)

  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true)
    applyAssetRoles(clone, asset)
    return clone
  }, [asset, gltf.scene])

  return <primitive object={scene} />
}

function ImportedObjectPreview({
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

function ImportedStlPreview({ asset, modelUrl }: { asset: AuraAssetDefinition, modelUrl: string }) {
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

function ImportedModelPreview({ asset, modelUrl }: { asset: AuraAssetDefinition, modelUrl: string }) {
  const unitScale = asset.sourceUnitScale ?? 1
  const offset = asset.sourceModelOffset ?? ([0, 0, 0] as [number, number, number])

  const model =
    asset.supportedFileType === 'fbx' ? (
      <ImportedObjectPreview asset={asset} modelUrl={modelUrl} loader={FBXLoader} />
    ) : asset.supportedFileType === 'obj' ? (
      <ImportedObjectPreview asset={asset} modelUrl={modelUrl} loader={OBJLoader} />
    ) : asset.supportedFileType === 'stl' ? (
      <ImportedStlPreview asset={asset} modelUrl={modelUrl} />
    ) : (
      <ImportedGltfPreview asset={asset} modelUrl={modelUrl} />
    )

  return (
    <group position={offset} scale={[unitScale, unitScale, unitScale]}>
      {model}
    </group>
  )
}

function CabinetPreview({ asset }: { asset: AuraAssetDefinition }) {
  const [width, height, depth] = asset.defaultDimensions
  const shell = asset.materials.find(material => material.target === 'shell')
  const drawerHeight = Math.max(0.1, (height - 1) / 4)

  return (
    <group>
      <mesh position={[0, height / 2, -0.1]}>
        <boxGeometry args={[width + 0.2, height + 0.2, depth]} />
        <meshStandardMaterial color={shell?.color ?? '#0f172a'} transparent={(shell?.opacity ?? 1) < 1} opacity={shell?.opacity ?? 1} depthWrite={(shell?.opacity ?? 1) >= 1} roughness={0.8} />
        <BoxOutline size={[width + 0.2, height + 0.2, depth]} color={holo.furnitureEdge} />
      </mesh>
      {[0, 1, 2, 3].map(index => (
        <DrawerPreview
          key={index}
          asset={asset}
          index={index}
          position={[0, (drawerHeight / 2) + 0.2 + index * (drawerHeight + 0.2), 0.12]}
          size={[Math.max(0.1, width - 0.2), drawerHeight, Math.max(0.1, depth - 0.2)]}
        />
      ))}
    </group>
  )
}

function DrawerPreview({
  asset,
  index,
  position,
  size,
}: {
  asset: AuraAssetDefinition
  index: number
  position: [number, number, number]
  size: [number, number, number]
}) {
  const material = asset.materials.find(item => item.target === `drawer-${index + 1}`)

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={material?.color ?? '#16a34a'}
          transparent
          opacity={material?.opacity ?? 0.34}
          depthWrite={(material?.opacity ?? 0.34) >= 1}
        roughness={0.8}
      />
      <BoxOutline size={size} color={holo.innerEdge} />
      </mesh>
      <mesh position={[0, 0, size[2] / 2 + 0.05]}>
        <boxGeometry args={[size[0] * 0.3, 0.1, 0.1]} />
        <meshBasicMaterial color={holo.itemEdge} transparent opacity={0.88} depthWrite={false} />
        <BoxOutline size={[size[0] * 0.3, 0.1, 0.1]} color={holo.selectionEdge} opacity={0.85} />
      </mesh>
    </group>
  )
}

function IBeamPreview({ asset }: { asset: AuraAssetDefinition }) {
  const [length, height, width] = asset.defaultDimensions
  const material = asset.materials[0]
  const color = material?.color ?? '#ef4444'
  const opacity = material?.opacity ?? 0.2
  const flangeHeight = height * 0.1
  const webWidth = width * 0.2

  return (
    <group position={[0, height / 2, 0]}>
      <mesh position={[0, -height / 2 + flangeHeight / 2, 0]}>
        <boxGeometry args={[length, flangeHeight, width]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        <BoxOutline size={[length, flangeHeight, width]} color={holo.furnitureEdge} />
      </mesh>
      <mesh>
        <boxGeometry args={[length, height - flangeHeight * 2, webWidth]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        <BoxOutline size={[length, height - flangeHeight * 2, webWidth]} color={holo.furnitureEdge} />
      </mesh>
      <mesh position={[0, height / 2 - flangeHeight / 2, 0]}>
        <boxGeometry args={[length, flangeHeight, width]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        <BoxOutline size={[length, flangeHeight, width]} color={holo.furnitureEdge} />
      </mesh>
    </group>
  )
}

function FootprintPreview({ asset }: { asset: AuraAssetDefinition }) {
  const halfW = asset.footprint.width / 2
  const halfD = asset.footprint.depth / 2
  const [offsetX, offsetZ] = asset.footprint.offset
  const points: [number, number, number][] = [
    [offsetX - halfW, 0.035, offsetZ - halfD],
    [offsetX + halfW, 0.035, offsetZ - halfD],
    [offsetX + halfW, 0.035, offsetZ + halfD],
    [offsetX - halfW, 0.035, offsetZ + halfD],
    [offsetX - halfW, 0.035, offsetZ - halfD],
  ]

  return <Line points={points} color={holo.furnitureEdge} lineWidth={1.5} depthTest={false} />
}

function CollisionPreview({ asset }: { asset: AuraAssetDefinition }) {
  return (
    <>
      {asset.collision.map(box => (
        <mesh key={box.id} position={box.center}>
          <boxGeometry args={box.size} />
          <meshBasicMaterial color={holo.collisionDebug} transparent opacity={0.12} wireframe />
        </mesh>
      ))}
    </>
  )
}

function SnapPointPreview({ asset }: { asset: AuraAssetDefinition }) {
  return (
    <>
      {asset.snapPoints.map(point => (
        <mesh key={point.id} position={[point.position[0], 0.08, point.position[2]]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color={holo.snapGuide} depthTest={false} />
        </mesh>
      ))}
    </>
  )
}

