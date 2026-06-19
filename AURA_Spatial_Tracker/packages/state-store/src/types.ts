/**
 * Core Types for the AURA Spatial Inventory System.
 * Represents the Physicalized Filesystem Hierarchy: Room -> Furniture -> Container -> Item
 */

export type Vector3 = [number, number, number];

export interface Item {
  id: string;
  name: string;
  quantity: number;
  tags: string[]; // e.g., ["LED", "5mm", "Red"] for better searching
  notes?: string;
}

export interface Container {
  id: string;
  name: string; // e.g., "Top Drawer", "Blue Pouch"
  type: 'drawer' | 'pouch' | 'box' | 'bin';
  items: Item[];
  // Where is it visually relative to the furniture?
  localPosition?: Vector3; 
}

export type AuraAssetPartMotion = 'static' | 'slide' | 'rotate';

export interface AuraAssetMaterial {
  id: string;
  target: string;
  color: string;
  opacity: number;
}

export interface AuraAssetMeshNode {
  id: string;
  name: string;
  type: 'mesh' | 'group';
  parentName?: string;
}

export interface AuraAssetCollisionBox {
  id: string;
  name: string;
  center: Vector3;
  size: Vector3;
}

export interface AuraAssetSnapPoint {
  id: string;
  name: string;
  position: Vector3;
}

export interface AuraAssetPart {
  id: string;
  name: string;
  meshName?: string;
  motion: AuraAssetPartMotion;
  axis: Vector3;
  closedOffset: number;
  openOffset: number;
  containerBounds?: {
    center: Vector3;
    size: Vector3;
  };
}

export interface AuraAssetDefinition {
  id: string;
  displayName: string;
  sourcePath?: string;
  sourceStorageKey?: string;
  sourceUnitScale?: number;
  sourceModelOffset?: Vector3;
  supportedFileType?: 'generated' | 'glb' | 'gltf' | 'obj' | 'stl' | 'fbx';
  defaultDimensions: Vector3;
  footprint: {
    width: number;
    depth: number;
    offset: [number, number]; // [x, z]
  };
  collision: AuraAssetCollisionBox[];
  snapPoints: AuraAssetSnapPoint[];
  parts: AuraAssetPart[];
  materials: AuraAssetMaterial[];
  meshNodes?: AuraAssetMeshNode[];
}

export interface Furniture {
  id: string;
  name: string; // e.g., "Main Electronics Rack"
  modelId: string; // References the downloaded 3D model (e.g., 'kenney_rack_1')
  position: Vector3; // World coordinates on the neon grid
  rotation: number; // Y-axis rotation in radians (0, PI/2, PI, etc)
  dimensions: Vector3; // Width, Height, Depth for bounds calculations
  containers: Container[];
}

export interface Room {
  id: string;
  name: string;
  furniture: Furniture[];
}
