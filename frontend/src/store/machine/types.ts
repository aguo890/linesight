/**
 * Machine Store Types
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Shared interfaces for the three-tier Zustand store architecture:
 * - $server: Pure WebSocket truth (never mutated by client)
 * - $pending: Optimistic mutations (keyed by entity + txId)
 * - $view: Memoized merge result (what UI renders)
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * SPEC REFERENCE
 * ───────────────────────────────────────────────────────────────────────────
 * @see docs/specs/live_data_architecture_spec.md
 *   - Part 1: WebSocket payload contracts
 *   - Part 2: Lock structure & Three-tier architecture
 *   - Part 3: ParsedBatch output contract
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * PROJECT BOARD TASK
 * ───────────────────────────────────────────────────────────────────────────
 * Task ID: LIVE-ST-01
 * Task: Define shared interfaces
 * Priority: P0 | Effort: M
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * RELATED FILES
 * ───────────────────────────────────────────────────────────────────────────
 * - serverSlice.ts  → Uses: MachineState, ServerState, SnapshotPayload, DeltaPayload
 * - pendingSlice.ts → Uses: PendingState, Lock, Transaction
 * - selectors.ts    → Uses: ViewState, all of the above
 * - index.ts        → Re-exports all types
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * IMPLEMENTATION CHECKLIST
 * ───────────────────────────────────────────────────────────────────────────
 * [ ] MachineState - Single machine's data fields (speed, temp, mode, status)
 * [ ] ServerState - Dictionary of all machines by ID
 * [ ] SnapshotPayload - WebSocket "snapshot" message shape
 * [ ] DeltaPayload - WebSocket "delta" message shape  
 * [ ] Lock - Field-level lock { value, txId, timestamp }
 * [ ] Transaction - { status, entities[], timestamp }
 * [ ] PendingState - { _transactions, [entityId]: { [field]: Lock } }
 * [ ] ViewState - Merged result with _isOptimistic flag
 * [ ] ParsedBatch - Excel parser output { txId, validRows, errors, summary }
 * [ ] CRITICAL_OVERRIDES - Safety bypass enum/array
 */

export { }; // Placeholder - remove when implementing
