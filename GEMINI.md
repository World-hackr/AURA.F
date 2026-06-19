## Core Architectural Mandates
1. **Propose Before Building:** Do not add powerful or complex features without explaining them briefly first and getting approval.
2. **Extreme Optimization:** Always find and implement the most optimized alternative for any feature.
3. **Hardware Safety:** Strictly avoid excessively compute-demanding features (like 60fps state updates) that could crash lower-end laptops.
4. **Exhaustive Inspection (Be Token Heavy):** Always heavily inspect all connected code, functions, and files before implementing a new feature to guarantee no unintended side-effects occur.

## AURA Project Context
Before changing the AURA app, read:

- `AURA_Spatial_Tracker/agents/handoff-current-state.md`
- `AURA_Spatial_Tracker/agents/architecture.md`
- `AURA_Spatial_Tracker/agents/agents.md`

These files record the current canvas/navigation decisions, snapping and geometry system, Asset Calibrator direction, GLB + AURA metadata pipeline, and holographic visual palette rules.
