# LineSight Design System

## 🎨 Color Palette

### Semantic Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--color-primary` | `#0ea5e9` | Primary actions, branding (Sky 500) |
| `--color-secondary` | `#64748b` | Secondary actions (Slate 500) |
| `--color-success` | `#22c55e` | Production targets met (Green 500) |
| `--color-warning` | `#eab308` | Machine idle, efficiency risk (Yellow 500) |
| `--color-danger` | `#ef4444` | Line stop, defects high (Red 500) |
| `--color-background` | `#0f172a` | App background (Slate 900) |
| `--color-surface` | `#1e293b` | Card/Widget background (Slate 800) |
| `--color-text` | `#f8fafc` | Primary text (Slate 50) |
| `--color-text-muted` | `#94a3b8` | Secondary text (Slate 400) |

### Factory Specifics
- **Production Green**: `#22c55e` (On Target)
- **Warning Yellow**: `#eab308` (Needs Attention)
- **Alert Red**: `#ef4444` (Critical Issue)
- **Idle Gray**: `#475569` (Offline)

## 📐 Typography
- **Font Family**: Inter, system-ui, sans-serif
- **Mono Font**: JetBrains Mono, monospace (for code/IDs)

## 🧩 Components
- **Dashboard Widget**: Rounded corners (`0.5rem`), padding (`1rem`), surface color
- **Data Grid**: Compact density, alternating rows
- **Status Badge**: Pill shape, semantic color background + text

## 🌓 Dark Mode
Default is **Dark Mode** for factory floor visibility.
Light mode available via toggle (class `.light`).
