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
