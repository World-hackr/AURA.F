import { useSpatialStore, type Furniture, type Vector3 } from '@aura/state-store'

export type LocalFootprint = {
  width: number
  depth: number
  offsetX: number
  offsetZ: number
}

export type FurnitureFootprint = {
  centerX: number
  centerZ: number
  halfX: number
  halfZ: number
  offsetX: number
  offsetZ: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const clampDimensions = (dimensions: Vector3): Vector3 => [
  Math.max(0.1, dimensions[0]),
  Math.max(0.1, dimensions[1]),
  Math.max(0.1, dimensions[2]),
]

export function getLocalFootprint(modelId: string, dimensions: Vector3): LocalFootprint {
  const assetDefinition = useSpatialStore.getState().assetDefinitions[modelId]
  const [rawW, , rawD] = clampDimensions(dimensions)

  if (assetDefinition) {
    const [defaultW, , defaultD] = clampDimensions(assetDefinition.defaultDimensions)
    const widthScale = defaultW > 0 ? rawW / defaultW : 1
    const depthScale = defaultD > 0 ? rawD / defaultD : 1

    return {
      width: assetDefinition.footprint.width * widthScale,
      depth: assetDefinition.footprint.depth * depthScale,
      offsetX: assetDefinition.footprint.offset[0] * widthScale,
      offsetZ: assetDefinition.footprint.offset[1] * depthScale,
    }
  }

  if (modelId === 'parametric') {
    const width = Math.max(0.5, rawW)
    const depth = Math.max(0.5, rawD)

    return {
      width: width + 0.2,
      depth: depth + 0.1,
      offsetX: 0,
      offsetZ: -0.05,
    }
  }

  return {
    width: rawW,
    depth: rawD,
    offsetX: 0,
    offsetZ: 0,
  }
}

export function getFurnitureFootprint({
  modelId,
  dimensions,
  position,
  rotation,
}: Pick<Furniture, 'modelId' | 'dimensions' | 'position' | 'rotation'>): FurnitureFootprint {
  const { width, depth, offsetX, offsetZ } = getLocalFootprint(modelId, dimensions)
  const rotationY = rotation || 0
  const signedCos = Math.cos(rotationY)
  const signedSin = Math.sin(rotationY)
  const absCos = Math.abs(signedCos)
  const absSin = Math.abs(signedSin)
  const rotatedOffsetX = offsetX * signedCos + offsetZ * signedSin
  const rotatedOffsetZ = -offsetX * signedSin + offsetZ * signedCos
  const centerX = position[0] + rotatedOffsetX
  const centerZ = position[2] + rotatedOffsetZ
  const halfX = (width * absCos + depth * absSin) / 2
  const halfZ = (width * absSin + depth * absCos) / 2

  return {
    centerX,
    centerZ,
    halfX,
    halfZ,
    offsetX: rotatedOffsetX,
    offsetZ: rotatedOffsetZ,
    minX: centerX - halfX,
    maxX: centerX + halfX,
    minZ: centerZ - halfZ,
    maxZ: centerZ + halfZ,
  }
}
