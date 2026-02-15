/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Machine Store - Central Nervous System
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Central Zustand store for real-time machine data.
 * Implements the three-tier architecture from the Live Data spec.
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                           ZUSTAND STORE                                 │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                         │
 * │  ┌─────────────┐                                                        │
 * │  │  $server    │  ← Pure WebSocket truth (serverSlice.ts)               │
 * │  │             │    Never mutated by client                             │
 * │  └──────┬──────┘                                                        │
 * │         │                                                               │
 * │         │  merge()                                                      │
 * │         ▼                                                               │
 * │  ┌─────────────┐                                                        │
 * │  │  $pending   │  ← Optimistic mutations (pendingSlice.ts)              │
 * │  │             │    Keyed by entity + txId                              │
 * │  └──────┬──────┘                                                        │
 * │         │                                                               │
 * │         │  selector                                                     │
 * │         ▼                                                               │
 * │  ┌─────────────┐                                                        │
 * │  │   $view     │  ← UI renders this (selectors.ts)                      │
 * │  │             │    Memoized merge result                               │
 * │  └─────────────┘                                                        │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * SPEC REFERENCE
 * ───────────────────────────────────────────────────────────────────────────
 * @see docs/specs/live_data_architecture_spec.md
 *   - Part 1: WebSocket Strategy (Passive Push) → serverSlice.ts
 *   - Part 2: Optimistic UI (Active Push) → pendingSlice.ts, selectors.ts
 *   - Part 3: Data Ingestion (Excel Parser) → types.ts (ParsedBatch)
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * PROJECT BOARD TASK
 * ───────────────────────────────────────────────────────────────────────────
 * Task ID: LIVE-ST-05
 * Task: Create store barrel export
 * Priority: P0 | Effort: S
 * 
 * Depends On:
 *   - LIVE-ST-01: types.ts
 *   - LIVE-ST-02: serverSlice.ts
 *   - LIVE-ST-03: pendingSlice.ts
 *   - LIVE-ST-04: selectors.ts
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * FILE STRUCTURE
 * ───────────────────────────────────────────────────────────────────────────
 * frontend/src/store/machine/
 * ├── types.ts           ← Shared interfaces (LIVE-ST-01)
 * ├── serverSlice.ts     ← Layer 1: WebSocket reducers (LIVE-ST-02)
 * ├── pendingSlice.ts    ← Layer 2: Optimistic reducers (LIVE-ST-03)
 * ├── selectors.ts       ← Layer 3: Merge logic (LIVE-ST-04)
 * └── index.ts           ← THIS FILE: Main export (LIVE-ST-05)
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * IMPLEMENTATION CHECKLIST
 * ───────────────────────────────────────────────────────────────────────────
 * [ ] Import and re-export all types from types.ts
 * [ ] Import createServerSlice and createPendingSlice
 * [ ] Create combined store using Zustand create()
 * [ ] Export useMachineStore hook
 * [ ] Re-export all selectors from selectors.ts
 */

// Re-export types
export * from './types';

// Store implementation is pending migration/re-implementation
// Previous implementation depended on missing modules (serverSlice, pendingSlice, selectors)

