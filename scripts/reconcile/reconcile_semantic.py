#!/usr/bin/env python3
"""
Semantic Project Board Reconciliation

Uses DeepSeek API to semantically match Git commits against board items,
catching discrepancies that literal ticket ID matching would miss.

Example: Commit "migrate to Docker-first PostgreSQL" matches board item
"PostgreSQL Migration" even without a ticket ID.
"""

import json
import subprocess
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from project root
project_root = Path(__file__).parent.parent.parent
load_dotenv(project_root / ".env")

# Try to import httpx, fall back to requests
try:
    import httpx
    HTTP_CLIENT = "httpx"
except ImportError:
    import requests
    HTTP_CLIENT = "requests"


# --- CONFIGURATION ---
BOARD_FILE = "../../PROJECT_BOARD.md"
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
GIT_LOOKBACK_DAYS = 30
# ---------------------


def get_api_key() -> str:
    """Get DeepSeek API key from environment."""
    key = os.getenv("DEEPSEEK_API_KEY")
    if not key:
        print("ERROR: DEEPSEEK_API_KEY not found in environment.")
        print("Please set it in your .env file or environment variables.")
        sys.exit(1)
    return key


def get_recent_commits(days: int = 30) -> list[dict]:
    """Get recent git commits with full messages."""
    since_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    
    # Use string command for Windows shell compatibility
    cmd = f'git log --since={since_date} --no-merges --format="%h|~|%s|~|%an|~|%ad" --date=short -n 20'
    
    try:
        # Find the git repo root by looking for .git folder
        repo_root = Path(__file__).resolve().parent.parent.parent
        print(f"   Looking for git repo at: {repo_root}")
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, cwd=str(repo_root), shell=True)
        
        commits = []
        for entry in result.stdout.strip().split('\n'):
            if not entry:
                continue
            parts = entry.split('|~|')
            if len(parts) >= 3:
                commits.append({
                    "hash": parts[0].strip().strip('"'),
                    "subject": parts[1].strip(),
                    "body": "",  # Skip body for now to simplify
                    "author": parts[2].strip(),
                    "date": parts[3].strip().strip('"') if len(parts) > 3 else ""
                })
        return commits
    except subprocess.CalledProcessError as e:
        print(f"Git error: {e.stderr}")
        return []
    except Exception as e:
        print(f"Error reading git log: {e}")
        return []


def get_incomplete_board_items(filepath: str) -> list[dict]:
    """Extract incomplete (Todo/In Progress) items from board."""
    import re
    
    if not os.path.exists(filepath):
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
    
    items = []
    current_section = ""
    
    for i, line in enumerate(lines):
        line_stripped = line.strip()
        
        # Track section headers
        if line_stripped.startswith('##'):
            current_section = line_stripped.replace('#', '').strip()
            continue
        
        # Look for incomplete checkbox items
        if '- [ ]' in line or '- [/]' in line or '[🟡]' in line or '[🚫]' in line:
            # Extract the task text
            task_text = re.sub(r'^\s*-\s*\[[^\]]*\]\s*', '', line_stripped)
            task_text = re.sub(r'\*\*([^*]+)\*\*', r'\1', task_text)  # Remove bold
            
            if task_text:
                items.append({
                    "line": i + 1,
                    "section": current_section,
                    "task": task_text[:200],
                    "raw": line_stripped[:150]
                })
        
        # Look for incomplete table items (⬜ Todo, 🟡 In Progress)
        if line_stripped.startswith('|') and ('⬜' in line or '🟡' in line):
            cells = [c.strip() for c in line_stripped.split('|') if c.strip()]
            if len(cells) >= 2:
                task_id = cells[0]
                task_desc = re.sub(r'<[^>]+>', ' ', cells[1])  # Strip HTML
                items.append({
                    "line": i + 1,
                    "section": current_section,
                    "task": f"{task_id}: {task_desc}"[:200],
                    "raw": line_stripped[:150]
                })
    
    return items


def call_deepseek(prompt: str, system_prompt: str) -> str:
    """Call DeepSeek API for semantic analysis."""
    api_key = get_api_key()
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 2000
    }
    
    try:
        if HTTP_CLIENT == "httpx":
            with httpx.Client(timeout=60) as client:
                response = client.post(DEEPSEEK_API_URL, headers=headers, json=payload)
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
        else:
            response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"DeepSeek API error: {e}")
        return ""


def semantic_reconcile(commits: list, board_items: list) -> dict:
    """Use LLM to find semantic matches between commits and board items."""
    
    system_prompt = """You are a Technical Project Manager AI. Your task is to reconcile Git commits against a project board.

RULES:
1. Find commits that COMPLETE work described in board items, even if no ticket ID is mentioned.
2. Look for semantic matches (e.g., "migrate to PostgreSQL" matches "PostgreSQL Migration" task).
3. Be strict: only match if the commit clearly addresses the board item.
4. Output ONLY valid JSON, no markdown, no explanation.

OUTPUT FORMAT:
{
  "matches": [
    {
      "commit_hash": "abc123",
      "commit_subject": "feat: migrate to PostgreSQL",
      "board_item_line": 52,
      "board_item_task": "Update connection strings in config.py",
      "confidence": "HIGH|MEDIUM|LOW",
      "reason": "Commit explicitly mentions PostgreSQL migration and config changes"
    }
  ],
  "unmatched_commits": [
    {
      "commit_hash": "def456",
      "commit_subject": "feat: add dark mode",
      "suggested_board_action": "Create new task or mark existing task complete"
    }
  ],
  "board_items_likely_done": [
    {
      "line": 52,
      "task": "PostgreSQL Migration",
      "evidence": "Commits abc123 and xyz789 together complete this work"
    }
  ]
}"""

    # Build the prompt with actual data
    commits_text = "\n".join([
        f"- {c['hash']} ({c['date']}): {c['subject']}\n  Body: {c['body'][:200]}"
        for c in commits[:15]  # Limit for context
    ])
    
    board_text = "\n".join([
        f"- Line {item['line']} [{item['section']}]: {item['task']}"
        for item in board_items[:50]  # Limit for context
    ])
    
    prompt = f"""## Recent Git Commits (last 30 days)
{commits_text}

## Incomplete Board Items (Todo / In Progress)
{board_text}

Analyze these and find:
1. Commits that complete board items (semantic match, not just ticket ID)
2. Board items that should be marked DONE based on commit evidence
3. Commits that represent work not tracked on the board

Return ONLY the JSON object."""

    print("🤖 Calling DeepSeek API for semantic analysis...")
    response = call_deepseek(prompt, system_prompt)
    
    # Try to parse JSON from response
    try:
        # Handle markdown code blocks
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            response = response.split("```")[1].split("```")[0]
        
        return json.loads(response.strip())
    except json.JSONDecodeError as e:
        print(f"Failed to parse LLM response as JSON: {e}")
        print(f"Raw response:\n{response[:500]}")
        return {"error": str(e), "raw_response": response[:500]}


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Semantic board reconciliation with DeepSeek")
    parser.add_argument('--board', default=BOARD_FILE, help='Path to PROJECT_BOARD.md')
    parser.add_argument('--days', type=int, default=GIT_LOOKBACK_DAYS, help='Git lookback days')
    parser.add_argument('--output', help='Output JSON file')
    
    args = parser.parse_args()
    
    script_dir = Path(__file__).parent
    board_path = script_dir / args.board if not Path(args.board).is_absolute() else Path(args.board)
    
    print("=" * 60)
    print("  Semantic Project Board Reconciliation (DeepSeek)")
    print("=" * 60)
    
    print(f"\n📋 Reading incomplete board items from: {board_path}")
    board_items = get_incomplete_board_items(str(board_path))
    print(f"   Found {len(board_items)} incomplete items")
    
    print(f"\n🔍 Reading Git commits (last {args.days} days)...")
    commits = get_recent_commits(args.days)
    print(f"   Found {len(commits)} commits")
    
    if not commits:
        print("No commits found. Exiting.")
        return
    
    result = semantic_reconcile(commits, board_items)
    
    if "error" in result:
        print(f"\n❌ Error: {result['error']}")
        return
    
    # Display results
    print("\n" + "=" * 60)
    print("  SEMANTIC RECONCILIATION REPORT")
    print("=" * 60)
    
    if result.get("matches"):
        print(f"\n🔗 Commit ↔ Board Matches ({len(result['matches'])}):")
        for match in result["matches"]:
            conf_emoji = {"HIGH": "🟢", "MEDIUM": "🟡", "LOW": "🔴"}.get(match.get("confidence", ""), "⚪")
            print(f"\n   {conf_emoji} [{match.get('confidence', 'N/A')}] Commit {match.get('commit_hash')}")
            print(f"      \"{match.get('commit_subject', '')}\"")
            print(f"      → Line {match.get('board_item_line')}: {match.get('board_item_task', '')[:60]}")
            print(f"      Reason: {match.get('reason', 'N/A')}")
    
    if result.get("board_items_likely_done"):
        print(f"\n✅ Board Items Likely DONE ({len(result['board_items_likely_done'])}):")
        for item in result["board_items_likely_done"]:
            print(f"\n   • Line {item.get('line')}: {item.get('task', '')[:60]}")
            print(f"     Evidence: {item.get('evidence', 'N/A')}")
    
    if result.get("unmatched_commits"):
        print(f"\n👻 Untracked Commits ({len(result['unmatched_commits'])}):")
        for commit in result["unmatched_commits"][:5]:
            print(f"   • {commit.get('commit_hash')}: {commit.get('commit_subject', '')[:50]}")
            print(f"     Action: {commit.get('suggested_board_action', 'N/A')}")
    
    print("\n" + "=" * 60)
    
    # Save full output
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        print(f"Full results saved to: {args.output}")
    else:
        print("\nFull JSON output:")
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
