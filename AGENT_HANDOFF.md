# AURA Spatial Inventory System - Agent Handoff Document

**Welcome, Codex (or any assisting Agent).** 
This document is your source of truth for the AURA project. Read this completely before writing or modifying any code. 

## 1. Project Philosophy
This is a **Visual Spatial Memory System** for dense shop environments (hardware/electronics). It solves the cognitive friction of translating database tables into physical locations.
*   **The Paradigm:** A "Physicalized Filesystem" (Room -> Furniture -> Container -> Item).
*   **The Visuals:** Dark, stark, high-contrast industrial CAD aesthetic. Pure blacks (`#000`), slate greys (`#1a1a1a`), and crisp white wireframe edges. *NO photorealism. NO blurred frosted-glass UI.*
*   **The Controls:** Professional CAD-style movement (like Fusion 360). Left-click pans, right-click orbits, scroll zooms. Camera features `infinityDolly` and Perspective/Orthographic toggles.

## 2. Architecture & Tech Stack
We are using a **Strict Monorepo** (pnpm workspace) to enforce extreme modularity. 

**Tech Stack:** `Vite` + `React` + `TypeScript` + `Three.js` + `@react-three/fiber` + `Zustand`.

### Package Structure
*   **`packages/state-store`**: The Brain. Pure Zustand/TypeScript. Defines the data hierarchy (`Room -> Furniture -> Container -> Item`). The 3D engine and UI only read/write to this store.
*   **`packages/engine-3d`**: The Renderer. Contains all `Three.js` and `@react-three/fiber` code. It receives a `modelId` from the store and renders either a custom `ParametricCabinet` or a `LoadedShelf` (parsing `.obj` files).
*   **`apps/desktop-viewer`**: The Shell. A Vite React app. It imports the 3D Engine and overlays a strict 20/60/20 CSS Flexbox UI layout. 

## 3. Strict Rules of Engagement
1.  **Do not break the 20/60/20 Layout:** The 3D Canvas lives strictly in the center 60% of the screen. The Left (20%) is the Command Center (Search/Catalog). The Right (20%) is the Inspector. 
2.  **No Textures:** 3D models must be stripped of image textures (e.g., `.tga` or `.png`). Apply dark `#1e293b` `MeshStandardMaterial` to imported meshes to maintain the blueprint aesthetic and high performance.
3.  **No Direct 3D DOM Manipulation for UI:** If you need the camera to move, dispatch an action to Zustand (`focusFurniture(id)`). The `<IsometricCamera>` component listens to this state and uses `CameraControls.setLookAt` to interpolate smoothly. Do not try to move the camera manually.
4.  **Drag Math is Offset:** Because the 3D canvas is squeezed into the center 60%, raycasting for drag-and-drop must calculate bounding boxes via `gl.domElement.getBoundingClientRect()`. Do not use `size.width` for pointer math, or the drag coordinates will be offset by 20vw.

## 4. Current State
*   **Working:** Isometric/Perspective/Top/Front toggles, infinite CAD grid, bounding-box drag snapping, parametric drawers (with sliding animation), and UI-to-3D Spawning.
*   **Pending:** Implementing the local offline database persistence (saving the Zustand state to disk), expanding the properties panel to edit parametric furniture dimensions dynamically, and adding specific items inside the drawers.

**End of Handoff. Acknowledge these rules before beginning your tasks.**