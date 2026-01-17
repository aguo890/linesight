#!/usr/bin/env python3
"""
Live Project Board Reconciliation Script

Parses PROJECT_BOARD.md (LineSight format) and reconciles against real Git history.

Supported Board Formats:
- Tables: | ID | Task | Priority | Effort | Status | Notes |
- Checkboxes: - [x] / - [ ] / - [/] items
- Status patterns: ✅ Done, 🟡 In Progress, ⬜ Todo, 🚫 Blocked, 🟡 Partial

Usage:
    python reconcile_live.py [--board BOARD_FILE] [--days LOOKBACK_DAYS]
"""

import json
import subprocess
import re
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


# --- CONFIGURATION ---
BOARD_FILE = "../../PROJECT_BOARD.md"  # Relative to script location
STALE_DAYS = 7
GIT_LOOKBACK_DAYS = 30
# ---------------------


def get_real_git_log(lookback_days: int = 30) -> list[dict]:
    """
    Runs `git log` to get history in a parseable format.
    Returns commits from the last N days.
    """
    since_date = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    
    # Git log format: hash|~|author|~|date|~|subject|~|refs
    cmd = [
        "git", "log",
        f"--since={since_date}",
        "--pretty=format:%h|~|%an|~|%ad|~|%s|~|%D",
        "--date=short",
        "--no-merges",
        "-n", "500"
    ]
    
    try:
        # Run from repo root
        repo_root = Path(__file__).parent.parent.parent
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            check=True,
            cwd=repo_root
        )
        lines = result.stdout.strip().split('\n')
        
        git_log = []
        for line in lines:
            if not line:
                continue
            parts = line.split("|~|")
            if len(parts) < 4:
                continue
            
            refs = parts[4] if len(parts) > 4 else ""
            # Check if commit is on main/master
            is_on_main = any(x in refs.lower() for x in ["main", "master", "head"])
            
            git_log.append({
                "hash": parts[0].strip(),
                "author": parts[1].strip(),
                "date": parts[2].strip(),
                "message": parts[3].strip(),
                "refs": refs.strip(),
                "is_merged_to_main": is_on_main
            })
        
        return git_log
    except subprocess.CalledProcessError as e:
        print(f"Git error: {e.stderr}")
        return []
    except Exception as e:
        print(f"Error reading git log: {e}")
        return []


def parse_linesight_board(filepath: str) -> list[dict]:
    """
    Parses LineSight PROJECT_BOARD.md format.
    
    Handles:
    1. Tables with | ID | Task | Priority | Effort | Status | Notes |
    2. Checkbox items: - [x], - [ ], - [/]
    3. Status emoji: ✅ Done, 🟡 In Progress, ⬜ Todo, 🚫 Blocked
    """
    if not os.path.exists(filepath):
        print(f"Board file not found: {filepath}")
        return []

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    board_items = []
    current_section = "Unknown"
    
    # Patterns for ticket IDs (LineSight format)
    # Matches: BE-001, FE-001, RBAC-001, ELT-DB-01, DARK-001, LIVE-001, etc.
    ticket_id_pattern = re.compile(
        r'\b([A-Z]+-[A-Z]*-?\d+[a-z]?)\b'
    )
    
    # Status patterns in table cells
    status_patterns = {
        '✅ Done': 'Done',
        '✅Done': 'Done',
        '✅': 'Done',
        '🟡 In Progress': 'In Progress',
        '🟡 Partial': 'In Progress',
        '🟡In Progress': 'In Progress',
        '🟡': 'In Progress',
        '⬜ Todo': 'Todo',
        '⬜Todo': 'Todo',
        '⬜': 'Todo',
        '🚫 Blocked': 'Blocked',
        '🚫': 'Blocked',
    }

    for i, line in enumerate(lines):
        line_stripped = line.strip()
        
        # Track section headers
        if line_stripped.startswith('##'):
            section_lower = line_stripped.lower()
            if 'completed' in section_lower or 'done' in section_lower:
                current_section = 'Done'
            elif 'in progress' in section_lower or 'current' in section_lower:
                current_section = 'In Progress'
            elif 'todo' in section_lower or 'next' in section_lower or 'up next' in section_lower:
                current_section = 'Todo'
            elif 'blocked' in section_lower:
                current_section = 'Blocked'
            else:
                current_section = 'Unknown'
            continue
        
        # Parse TABLE rows (| ID | Task | ... | Status | ...)
        if line_stripped.startswith('|') and not line_stripped.startswith('|--'):
            cells = [c.strip() for c in line_stripped.split('|')]
            cells = [c for c in cells if c]  # Remove empty cells
            
            if len(cells) >= 4:
                # Skip header rows
                if cells[0].lower() in ['id', 'metric', '**user management**', '**data ingestion', '**analytics']:
                    continue
                
                # Extract ticket ID
                potential_id = cells[0]
                id_match = ticket_id_pattern.search(potential_id)
                ticket_id = id_match.group(1) if id_match else potential_id[:20]
                
                # Extract task title
                task_title = cells[1] if len(cells) > 1 else ""
                # Strip HTML tags
                task_title = re.sub(r'<[^>]+>', ' ', task_title).strip()
                
                # Determine status from table cells
                status = current_section
                for cell in cells:
                    for emoji, status_name in status_patterns.items():
                        if emoji in cell:
                            status = status_name
                            break
                
                if ticket_id and task_title:
                    board_items.append({
                        "id": ticket_id,
                        "title": task_title[:80],
                        "status": status,
                        "source": "table",
                        "line_number": i + 1
                    })
        
        # Parse CHECKBOX items (- [ ] task or - [x] task)
        checkbox_match = re.match(r'^-\s*\[([ x/])\]\s*(.+)$', line_stripped, re.IGNORECASE)
        if checkbox_match:
            check_state = checkbox_match.group(1).lower()
            task_text = checkbox_match.group(2).strip()
            
            # Determine status from checkbox
            if check_state == 'x':
                status = 'Done'
            elif check_state == '/':
                status = 'In Progress'
            else:
                status = 'Todo'
            
            # Try to extract ticket ID from task text
            id_match = ticket_id_pattern.search(task_text)
            ticket_id = id_match.group(1) if id_match else task_text[:30].replace(' ', '_')
            
            # Clean up task text
            task_title = re.sub(r'\*\*([^*]+)\*\*', r'\1', task_text)  # Remove bold
            
            board_items.append({
                "id": ticket_id,
                "title": task_title[:80],
                "status": status,
                "source": "checkbox",
                "line_number": i + 1
            })

    return board_items


def reconcile_live(board: list, git_log: list) -> dict:
    """
    Reconcile board state against git history.
    
    Returns:
        {
            "status_updates": [...],
            "ghost_work": [...],
            "stale_items": [...],
            "stats": {...}
        }
    """
    output = {
        "status_updates": [],
        "ghost_work": [],
        "stale_items": [],
        "verified_done": [],
        "stats": {
            "total_board_items": len(board),
            "total_commits": len(git_log),
            "done_items": 0,
            "in_progress_items": 0,
            "todo_items": 0,
            "blocked_items": 0
        }
    }
    
    # Collect all ticket IDs for ghost work detection
    all_ticket_ids = {item['id'] for item in board}
    
    # Also add common variations (without leading zeros, etc.)
    for item in board:
        tid = item['id']
        # Add lowercase version
        all_ticket_ids.add(tid.lower())
        # Add with different separators
        all_ticket_ids.add(tid.replace('-', '_'))
        all_ticket_ids.add(tid.replace('_', '-'))
    
    for ticket in board:
        t_id = ticket['id']
        status = ticket['status']
        
        # Track stats
        if status == 'Done':
            output['stats']['done_items'] += 1
        elif status == 'In Progress':
            output['stats']['in_progress_items'] += 1
        elif status == 'Todo':
            output['stats']['todo_items'] += 1
        elif status == 'Blocked':
            output['stats']['blocked_items'] += 1
        
        # Find commits referencing this ticket (case-insensitive)
        related_commits = [
            c for c in git_log 
            if t_id.lower() in c['message'].lower() or t_id.replace('-', '_').lower() in c['message'].lower()
        ]
        
        # Logic: Todo -> In Progress (if commits exist)
        if status == 'Todo' and related_commits:
            latest_commit = related_commits[0]
            output["status_updates"].append({
                "ticket_id": t_id,
                "title": ticket['title'],
                "old_status": "Todo",
                "new_status": "In Progress",
                "reason": f"Active commits detected: {latest_commit['hash']} on {latest_commit['date']}",
                "line_number": ticket.get('line_number', 'N/A')
            })
        
        # Logic: In Progress -> Done (if merged to main)
        elif status == 'In Progress':
            merged_commits = [c for c in related_commits if c.get('is_merged_to_main')]
            if merged_commits:
                output["status_updates"].append({
                    "ticket_id": t_id,
                    "title": ticket['title'],
                    "old_status": "In Progress",
                    "new_status": "Done",
                    "reason": f"Merged to main: {merged_commits[0]['hash']}",
                    "line_number": ticket.get('line_number', 'N/A')
                })
            elif not related_commits:
                # Check if stale (no recent commits)
                output["stale_items"].append({
                    "ticket_id": t_id,
                    "title": ticket['title'],
                    "status": status,
                    "reason": f"No commits found in last {GIT_LOOKBACK_DAYS} days",
                    "line_number": ticket.get('line_number', 'N/A')
                })
        
        # Verify Done items have actual commits
        elif status == 'Done':
            if related_commits:
                output["verified_done"].append({
                    "ticket_id": t_id,
                    "title": ticket['title'],
                    "last_commit": related_commits[0]['hash'],
                    "last_commit_date": related_commits[0]['date']
                })
    
    # Ghost Work Detection: Commits without ticket IDs
    for commit in git_log:
        msg_lower = commit['message'].lower()
        
        # Skip common non-ticket commits
        skip_patterns = ['merge', 'initial commit', 'update readme', 'bump version', 'fix typo']
        if any(skip in msg_lower for skip in skip_patterns):
            continue
        
        # Check if any ticket ID is referenced
        has_ticket_ref = False
        for t_id in all_ticket_ids:
            if t_id.lower() in msg_lower:
                has_ticket_ref = True
                break
        
        if not has_ticket_ref:
            output["ghost_work"].append({
                "commit_hash": commit['hash'],
                "author": commit['author'],
                "date": commit['date'],
                "message": commit['message'][:100],
                "suggested_action": "Create ticket or add ID to commit message"
            })
    
    # Limit ghost work to most recent 10
    output["ghost_work"] = output["ghost_work"][:10]
    
    return output


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Reconcile LineSight project board against Git history"
    )
    parser.add_argument(
        '--board',
        default=BOARD_FILE,
        help='Path to PROJECT_BOARD.md'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=GIT_LOOKBACK_DAYS,
        help='Number of days to look back in Git history'
    )
    parser.add_argument(
        '--output',
        help='Output file path (JSON). If not specified, prints to stdout.'
    )
    parser.add_argument(
        '--format',
        choices=['json', 'summary'],
        default='summary',
        help='Output format'
    )
    
    args = parser.parse_args()
    
    # Resolve paths relative to script location
    script_dir = Path(__file__).parent
    board_path = script_dir / args.board if not Path(args.board).is_absolute() else Path(args.board)
    
    print("=" * 60)
    print("  LineSight Project Board Reconciliation")
    print("=" * 60)
    
    print(f"\n📋 Reading Board: {board_path}")
    board = parse_linesight_board(str(board_path))
    print(f"   Found {len(board)} items")
    
    print(f"\n🔍 Reading Git History (last {args.days} days)...")
    git_log = get_real_git_log(lookback_days=args.days)
    print(f"   Found {len(git_log)} commits")
    
    print(f"\n⚙️  Running Reconciliation...")
    result = reconcile_live(board, git_log)
    
    if args.format == 'json':
        output_json = json.dumps(result, indent=2)
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output_json)
            print(f"\n✅ Results saved to: {args.output}")
        else:
            print(output_json)
    else:
        # Summary format
        print("\n" + "=" * 60)
        print("  RECONCILIATION REPORT")
        print("=" * 60)
        
        stats = result['stats']
        print(f"\n📊 Board Statistics:")
        print(f"   Total Items:    {stats['total_board_items']}")
        print(f"   ✅ Done:        {stats['done_items']}")
        print(f"   🟡 In Progress: {stats['in_progress_items']}")
        print(f"   ⬜ Todo:        {stats['todo_items']}")
        print(f"   🚫 Blocked:     {stats['blocked_items']}")
        
        if result['status_updates']:
            print(f"\n🔄 Recommended Status Updates ({len(result['status_updates'])}):")
            for update in result['status_updates']:
                print(f"   • [{update['ticket_id']}] {update['old_status']} → {update['new_status']}")
                print(f"     Reason: {update['reason']}")
                print(f"     Line: {update['line_number']}")
        else:
            print("\n✅ No status updates needed!")
        
        if result['stale_items']:
            print(f"\n⚠️  Stale Items ({len(result['stale_items'])}):")
            for item in result['stale_items']:
                print(f"   • [{item['ticket_id']}] {item['title'][:50]}...")
                print(f"     Status: {item['status']} | Line: {item['line_number']}")
        
        if result['ghost_work']:
            print(f"\n👻 Ghost Work (Commits Without Ticket IDs) ({len(result['ghost_work'])}):")
            for ghost in result['ghost_work'][:5]:
                print(f"   • {ghost['commit_hash']} ({ghost['date']}) - {ghost['author']}")
                print(f"     \"{ghost['message'][:60]}...\"")
        
        if result['verified_done']:
            print(f"\n✅ Verified Done Items: {len(result['verified_done'])} (with matching commits)")
        
        print("\n" + "=" * 60)
        print("  END OF REPORT")
        print("=" * 60)


if __name__ == "__main__":
    main()
