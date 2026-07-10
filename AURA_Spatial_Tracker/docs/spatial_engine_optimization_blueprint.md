# AURA Multi-Scale Spatial Engine: Optimization & Architecture Blueprint

This document acts as the master record of our transition from a single-room shop canvas to an optimized, world-scale spatial tracking system. It records our design choices, optimization formulas, and implementation roadmap.

---

## 1. Core Architecture Shift

We are expanding the inventory system from a single-room canvas to a **Multi-Scale Spatial Map**. 

### Grid Abyss (World Scale)
A 2D dark abyss grid mapped to real-world coordinates. Users place building outlines (houses) directly on the grid.

### House Design (Interior Scale)
Double-clicking any house outline transitions the viewport downward, loading the 3D room interior canvas to place furniture and containers.

```
+-------------------------------------------------------------+
|                     WORLD MAP (2D GRID ABYSS)               |
|                                                             |
|      [House A Plot]                    [House B Plot]       |
|      (Lat/Lng coords)                  (Lat/Lng coords)     |
+-------------------------------------------------------------+
                               |
                               | (Double Click Zoom)
                               v
+-------------------------------------------------------------+
|                     HOUSE DESIGN (3D CANVAS)                |
|                                                             |
|      [Outer Walls Shell] -> [Rooms] -> [Furniture] -> [Item]|
+-------------------------------------------------------------+
```

---

## 2. Rendering Optimization Mechanics

To maintain 60 FPS on low-end hardware (laptops, phones) even when looking at a map extending for miles, we implement three core graphics algorithms:

### 2.1 Infinite Snapping Grid (Zero Memory Growth)
* **Problem**: Traditional 3D grids render a massive static grid geometry. Zooming or panning out far requires drawing millions of grid lines, which rapidly degrades CPU/GPU performance.
* **Solution**: We render a single, small `gridHelper` (e.g., 200m x 200m). When the camera pans, we track the camera's target center and dynamically shift the grid's position to snap to the nearest grid interval.
* **Math Formula**:
  $$\text{GridPosition}_X = \text{round}\left(\frac{\text{CameraTarget}_X}{\text{GridStep}}\right) \times \text{GridStep}$$
  $$\text{GridPosition}_Z = \text{round}\left(\frac{\text{CameraTarget}_Z}{\text{GridStep}}\right) \times \text{GridStep}$$
* **Result**: The grid appears infinite as you pan forever, but the GPU only ever renders a single lightweight grid geometry.

### 2.2 Depth-Fog & Horizon Clipping (Frustum Limiting)
* **Problem**: Shallow camera angles display objects miles away, causing massive rendering queues.
* **Solution**: 
  1. We clamp `camera.far` to 5 km. The GPU completely ignores anything further.
  2. To prevent objects from suddenly pop-rendering at the 5 km boundary, we enable black depth fog (`scene.fog = new THREE.FogExp2('#000000', 0.00015)`). Distant geometry fades smoothly into the black abyss.

### 2.3 Outer-Wall Footprint Shells (Level of Detail - LOD)
* **Problem**: Replacing distant houses with generic boxes ruins spatial recognition. Rendering all interior furniture/items for thousands of distant houses crashes the browser.
* **Solution**: We store the house's outer wall contours as a simple 2D polygon (4 to 12 vertices). 
  * **Zoomed Out (Far)**: We turn off rendering for the interior furniture and draw only the extruded outer wall shell of each building.
  * **Zoomed In (Close)**: We activate the detailed interior renderer for the single active house.
  * **Result**: Houses retain their unique shapes from afar, but we bypass rendering 95% of the total 3D polygon count (since furniture accounts for almost all of the geometry).

---

## 3. Database Schema Clean-up

To support multiple houses on the world grid, the Zustand store is restructured to separate coordinates, outlines, and interior content.

```json
{
  "activeHouseId": "house-101",
  "houses": [
    {
      "id": "house-101",
      "name": "Warehouse A",
      "worldCoordinates": [120.5, -45.2],
      "wallFootprint": [
        [0, 0],
        [20, 0],
        [20, 15],
        [0, 15]
      ],
      "wallHeight": 3.2,
      "interior": {
        "rooms": [],
        "furniture": []
      }
    }
  ]
}
```

---

## 4. Implementation Roadmap

```
Step 1: Infinite Snapping Grid  ==>  Step 2: Database Schema Refactor  ==>  Step 3: Multi-Building Renderer
(Replace static grid helper)        (Zustand store coordinates update)       (Instanced Wall Shell LODs)
```

1. **Step 1 (Immediate)**: Code the `InfiniteGridHelper` component. Replace the static grid in `App.tsx` and run builds to verify performance.
2. **Step 2**: Refactor `packages/state-store/src/store.ts` to support the multi-building schema.
3. **Step 3**: Implement the 2D map viewer overlay and camera zoom transitions.
