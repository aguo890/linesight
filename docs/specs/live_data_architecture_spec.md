# Live Data Architecture Specification (v1.0)

> **Status:** Design Complete | **Target:** Factory-Grade Resilience  
> **Patterns:** WebSocket Pub/Sub + Optimistic UI Shadow Layer  
> **Project Board:** [EPIC 10: Live Data Layer](file:///c:/Users/19803/business/FactoryExcelManager/PROJECT_BOARD.md#epic-10-live-data-layer)

---

## File Structure Map

The implementation is organized across modular store slices:

```
frontend/src/store/machine/
├── types.ts           → Part 1 & 2: SharedInterfaces (MachineState, Lock, Transaction)
├── serverSlice.ts     → Part 1: WebSocket reducers ($server layer)
├── pendingSlice.ts    → Part 2: Optimistic reducers ($pending layer)
├── selectors.ts       → Part 2: Merge logic ($view layer)
└── index.ts           → Export barrel (main store entry)

frontend/src/workers/
└── excelParser.worker.ts → Part 3: Web Worker for Excel parsing (TBD)

frontend/src/hooks/
└── useLiveSocket.ts   → Part 1: WebSocket connection hook (TBD)
```

---

## Part 1: WebSocket Strategy (Passive Push)

### Subscription Topology

```
                    ┌─────────────────┐
                    │ dashboard:global│  (Low frequency: 5s)
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼───────┐ ┌──────▼──────┐ ┌───────▼───────┐
    │   line:01     │ │   line:02   │ │   line:03     │
    └───────┬───────┘ └─────────────┘ └───────────────┘
            │
    ┌───────┼───────┐
    │       │       │
┌───▼───┐┌──▼──┐┌───▼───┐
│m:401  ││m:402││m:403  │  (High frequency: 250ms)
└───────┘└─────┘└───────┘
```

### Payload Contract

```json
// Snapshot (on subscribe)
{
  "type": "snapshot",
  "topic": "line:01",
  "seq": 0,
  "data": {
    "machines": {...},
    "kpis": {...}
  }
}

// Delta (on update)
{
  "type": "delta",
  "topic": "line:01", 
  "seq": 142,
  "ts": 1704230000,
  "machines": {
    "m_402": {
      "speed": 142,
      "temp": 88.5
    }
  }
}
```

### Connection State Machine

| State | UI Indicator | Trigger |
|-------|--------------|---------|
| `CONNECTING` | Yellow pulse | Initial connect / reconnect |
| `CONNECTED` | Green dot | WebSocket open + subscription ACK |
| `STALE` | Amber dot + "30s ago" | No heartbeat for 5s |
| `DISCONNECTED` | Red + desaturated UI | Socket close event |

### Reconnection Algorithm

```
Attempt 1: Immediate
Attempt 2: 2 seconds
Attempt 3: 5 seconds  
Attempt 4: 10 seconds
Attempt 5+: 30 seconds (cap)
```

### Bidirectional Heartbeat

```
Server → Client: { "type": "ping", "ts": ... }  (every 5s)
Client → Server: { "type": "pong", "ts": ... }  (response)

If no ping for 5s → Mark STALE
If no pong for 3s → Server closes connection
```

---

## Part 2: Optimistic UI (Active Push)

### Three-Tier State Architecture

```
┌─────────────────────────────────────────────────────┐
│                    ZUSTAND STORE                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐                                    │
│  │  $server    │  ← Pure WebSocket truth            │
│  │             │    Never mutated by client         │
│  └──────┬──────┘                                    │
│         │                                           │
│         │  merge()                                  │
│         ▼                                           │
│  ┌─────────────┐                                    │
│  │  $pending   │  ← Optimistic mutations            │
│  │             │    Keyed by entity + txId          │
│  └──────┬──────┘                                    │
│         │                                           │
│         │  selector                                 │
│         ▼                                           │
│  ┌─────────────┐                                    │
│  │   $view     │  ← UI renders this                 │
│  │             │    Memoized merge result           │
│  └─────────────┘                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Lock Structure (Field-Level)

```typescript
interface PendingState {
  _transactions: {
    [txId: string]: {
      status: 'inflight' | 'confirmed' | 'failed';
      entities: string[];
      timestamp: number;
    };
  };
  [entityId: string]: {
    [field: string]: {
      value: any;
      txId: string;
      timestamp: number;
    };
  };
}
```

### Optimistic Lifecycle

| Phase | State | Duration | Action |
|-------|-------|----------|--------|
| 1 | Parse | ~100ms | Excel → JSON, generate txId |
| 2 | Optimistic | ~500ms | Apply to $pending, render immediately |
| 3 | Inflight | ~1-3s | HTTP POST, ignore conflicting WS |
| 4 | Confirmed | ~2s | HTTP 200, wait for WS convergence |
| 5 | Reconciled | — | WS matches, clear $pending |

### Merge Selector Logic

```typescript
function getRenderState(server: ServerState, pending: PendingState): ViewState {
  const view = structuredClone(server);
  
  for (const [entityId, fields] of Object.entries(pending)) {
    if (entityId === '_transactions') continue;
    
    const serverEntity = server[entityId];
    
    // 1. Safety bypass - E-Stop always wins
    if (CRITICAL_OVERRIDES.includes(serverEntity?.status)) {
      continue;
    }
    
    for (const [field, lock] of Object.entries(fields)) {
      // 2. Check lock expiry (10s timeout)
      if (Date.now() - lock.timestamp > 10000) {
        continue;
      }
      
      // 3. Apply optimistic value
      view[entityId] = {
        ...view[entityId],
        [field]: lock.value,
        _isOptimistic: true
      };
    }
  }
  
  return view;
}
```

### Safety Bypass Fields

```typescript
const CRITICAL_OVERRIDES = [
  'EMERGENCY_STOP',
  'FAULT',
  'MAINTENANCE_LOCK',
  'SAFETY_INTERLOCK'
];
```

### Visual Feedback

| State | Style | Indicator |
|-------|-------|-----------|
| Idle | Default | — |
| Optimistic | Blue text, 80% opacity | Sync spinner |
| Confirmed | Green text, pulse | Checkmark |
| Reconciled | Default | — |
| Failed | Red flash → revert | Error toast |
| Conflict | Amber highlight | "Updated by another operator" |

---

## Part 3: Data Ingestion (Excel Parser)

### ETL Pipeline Strategy

The parser acts as the bridge between raw user files and the Optimistic Store. It must run entirely on the client-side (Web Worker) to prevent UI freezing during large uploads.

```
File Drop → Parse (SheetJS) → Validate (Zod) → Transform → Optimistic Commit
```

### Parsing Rules

| Stage | Rule | Action on Fail |
|-------|------|----------------|
| **1. Header Check** | Must contain: `Machine ID`, `Target Speed` | Reject File ("Invalid Template") |
| **2. Type Cast** | Convert "100" (string) to `100` (number) | Warning/default or skip row |
| **3. Validation** | `Speed` must be 0-3000 | Flag Row Error |
| **4. ID Check** | `Machine ID` must exist in `$server` | Flag Row Error |

### Validation Schema (Zod)

```typescript
const BatchUploadSchema = z.array(z.object({
  machineId: z.string().regex(/^m:\d+$/),
  targetSpeed: z.number().min(0).max(3000),
  mode: z.enum(['RUN', 'IDLE', 'MAINTENANCE']).optional()
}));
```

### Output Contract (Store Feed)

The parser must output a dictionary optimized for the `$pending` store `updates` argument.

```typescript
// Output Shape
interface ParsedBatch {
  txId: string; // Generated UUID
  validRows: {
    [machineId: string]: {
      speed?: number;
      mode?: string;
      // ...other fields
    }
  };
  errors: Array<{ row: number; msg: string }>;
  summary: { total: number; valid: number; invalid: number };
}
```

### Performance Constraints

| Constraint | Threshold | Strategy |
|------------|-----------|----------|
| **Web Worker** | File > 50KB | Parse in dedicated worker thread |
| **Chunking** | Rows > 1000 | Process in chunks of 500 to allow GC |

---

## Implementation Checklist

### WebSocket Layer
- [ ] Create `useLiveSocket` hook with topic subscription
- [ ] Implement heartbeat monitor (5s timeout)
- [ ] Add sequence number tracking for delta integrity
- [ ] Build reconnection state machine with backoff
- [ ] Add `visibilitychange` pause/resume logic

### Optimistic UI Layer  
- [ ] Create Zustand store with three-tier structure
- [ ] Implement field-level lock manager
- [ ] Build memoized merge selector
- [ ] Add transaction batching for Excel uploads
- [ ] Implement safety bypass for critical fields
- [ ] Add 10s timeout with warning toast
- [ ] Build conflict detection and notification

### Data Ingestion Layer
- [ ] Create `ExcelParserWorker` Web Worker
- [ ] Implement SheetJS parsing with header validation
- [ ] Build Zod schema for `BatchUploadSchema`
- [ ] Add type coercion with warning collection
- [ ] Implement machine ID existence check against `$server`
- [ ] Build chunked processing for large files (>1000 rows)
- [ ] Add file size detection for worker offloading (>50KB)
- [ ] Create `ParsedBatch` transformer for store integration

### Integration
- [ ] Connect WebSocket to $server store
- [ ] Wire Excel upload to $pending store
- [ ] Add visual feedback components
- [ ] Test E-Stop bypass scenario
- [ ] Test upload timeout scenario
- [ ] Test concurrent operator conflict
