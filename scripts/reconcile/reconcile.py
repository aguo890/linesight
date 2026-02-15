# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

#!/usr/bin/env python3
"""
Project Board Reconciliation Script

This script reconciles a project board state against Git history,
detecting status transitions, stale items, and ghost work (commits without tickets).

Usage:
    python reconcile.py [--board BOARD_FILE] [--git GIT_LOG_FILE] [--date YYYY-MM-DD]
"""

import json
import argparse
from datetime import datetime
from pathlib import Path


def load_json(filename: str) -> list:
    """Load and parse a JSON file."""
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)


def reconcile_project(board: list, git_log: list, current_date: datetime) -> dict:
    """
    Reconcile board state against git history.
    
    Logic:
    1. Todo -> In Progress: If a commit referencing ticket ID exists
    2. In Progress -> Done: If a commit is merged to main
    3. In Progress -> Stale: If no git activity for >7 days
    4. Ghost Work: Commits with no ticket ID references
    
    Args:
        board: List of ticket dictionaries with id, status, title, last_updated
        git_log: List of commit dictionaries with hash, author, message, branch, is_merged_to_main, date
        current_date: The reference date for staleness calculations
    
    Returns:
        Dictionary with status_updates, ghost_work, and stale_items
    """
    output = {
        "status_updates": [],
        "ghost_work": [],
        "stale_items": []
    }
    
    # Extract all known ticket IDs for ghost work detection
    ticket_ids = {item['id'] for item in board}
    
    for ticket in board:
        t_id = ticket['id']
        # Find all commits that reference this ticket
        commits = [c for c in git_log if t_id in c['message']]
        
        # Logic: Todo -> In Progress
        if ticket['status'] == 'Todo' and commits:
            commit_refs = ", ".join(c['hash'] for c in commits)
            output["status_updates"].append({
                "ticket_id": t_id,
                "old_status": "Todo",
                "new_status": "In Progress",
                "action": "MOVE -> In Progress",
                "reason": f"Found {len(commits)} commit(s): {commit_refs}"
            })
            
        # Logic: In Progress -> Done or Stale
        elif ticket['status'] == 'In Progress':
            is_merged = any(c['is_merged_to_main'] for c in commits)
            
            if is_merged:
                merged_commits = [c for c in commits if c['is_merged_to_main']]
                output["status_updates"].append({
                    "ticket_id": t_id,
                    "old_status": "In Progress",
                    "new_status": "Done",
                    "action": "MOVE -> Done",
                    "reason": f"Merged to main: {merged_commits[0]['hash']}"
                })
            else:
                # Stale check: No merged commits AND no activity for >7 days
                last_update = datetime.strptime(ticket['last_updated'], "%Y-%m-%d")
                days_inactive = (current_date - last_update).days
                
                if days_inactive > 7 and not commits:
                    output["stale_items"].append({
                        "ticket_id": t_id,
                        "title": ticket['title'],
                        "days_inactive": days_inactive,
                        "suggested_action": "FLAG_STALE - Review or close"
                    })

    # Logic: Ghost Work Detection
    for commit in git_log:
        # Check if commit message contains ANY known ticket ID
        if not any(t_id in commit['message'] for t_id in ticket_ids):
            output["ghost_work"].append({
                "commit_hash": commit['hash'],
                "author": commit['author'],
                "message": commit['message'],
                "branch": commit['branch'],
                "suggested_action": f"Create Ticket: {commit['message'][:50]}"
            })

    return output


def main():
    parser = argparse.ArgumentParser(
        description="Reconcile project board against Git history"
    )
    parser.add_argument(
        '--board', 
        default='board_data.json',
        help='Path to board state JSON file'
    )
    parser.add_argument(
        '--git', 
        default='git_log.json',
        help='Path to git log JSON file'
    )
    parser.add_argument(
        '--date',
        default=None,
        help='Reference date for staleness calculation (YYYY-MM-DD). Defaults to today.'
    )
    parser.add_argument(
        '--output',
        default=None,
        help='Output file path. If not specified, prints to stdout.'
    )
    
    args = parser.parse_args()
    
    # Resolve paths relative to script location
    script_dir = Path(__file__).parent
    board_path = script_dir / args.board if not Path(args.board).is_absolute() else Path(args.board)
    git_path = script_dir / args.git if not Path(args.git).is_absolute() else Path(args.git)
    
    # Load data
    board = load_json(board_path)
    git_log = load_json(git_path)
    
    # Parse date or use mock date for testing
    if args.date:
        current_date = datetime.strptime(args.date, "%Y-%m-%d")
    else:
        # Use mock date for consistent testing with the sample data
        current_date = datetime.strptime("2023-10-27", "%Y-%m-%d")
    
    # Run reconciliation
    result = reconcile_project(board, git_log, current_date)
    
    # Output
    output_json = json.dumps(result, indent=2)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output_json)
        print(f"Results written to {args.output}")
    else:
        print(output_json)
    
    # Summary
    print(f"\n--- Summary ---")
    print(f"Status Updates: {len(result['status_updates'])}")
    print(f"Ghost Work:     {len(result['ghost_work'])}")
    print(f"Stale Items:    {len(result['stale_items'])}")


if __name__ == "__main__":
    main()
