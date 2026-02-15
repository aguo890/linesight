# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

#!/usr/bin/env python3
"""
V2 Code-First Project Board Reconciler - AUTO-UPDATE MODE

This version:
1. Marks verified tasks as done
2. Auto-inserts Ghost Work as a new section
3. Creates backup before modifying

"Commits are claims, code is truth."
"""

import os
import re
import json
import subprocess
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load .env from repo root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO_ROOT / ".env")

try:
    import httpx
    HTTP_CLIENT = "httpx"
except ImportError:
    import requests
    HTTP_CLIENT = "requests"

# --- Configuration ---
BOARD_PATH = REPO_ROOT / "PROJECT_BOARD.md"
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

CRITICAL_FILES = [
    "docker-compose.yml",
    "Makefile",
    "backend/app/core/config.py",
    "backend/app/core/database.py",
    "backend/alembic.ini",
    "backend/requirements.txt",
    "frontend/package.json",
]

FILE_TREE_PREFIXES = [
    "backend/app/api/",
    "backend/app/services/",
    "backend/app/models/",
    "backend/app/core/",
    "frontend/src/components/",
    "frontend/src/pages/",
    "frontend/src/contexts/",
    "frontend/src/hooks/",
    "frontend/src/store/",
    "frontend/src/locales/",
]


def check_api_key():
    if not DEEPSEEK_API_KEY:
        print("❌ Error: DEEPSEEK_API_KEY environment variable not set.")
        exit(1)


def get_git_commits(days: int = 14) -> list[str]:
    since_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    cmd = f'git log --since={since_date} --no-merges --format="%h|%s|%an|%ad" --date=short -n 30'
    
    try:
        result = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True, check=True, shell=True)
        return [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
    except Exception as e:
        print(f"⚠️  Git log error: {e}")
        return []


def scan_codebase_evidence() -> dict:
    evidence = {}
    
    print("   📂 Scanning file structure...")
    try:
        result = subprocess.run("git ls-files", cwd=str(REPO_ROOT), capture_output=True, text=True, shell=True)
        all_files = result.stdout.strip().split("\n")
        
        filtered_files = [
            f for f in all_files 
            if any(f.startswith(prefix) for prefix in FILE_TREE_PREFIXES)
        ]
        
        evidence["file_structure"] = filtered_files[:250]
        evidence["total_files"] = len(all_files)
    except Exception as e:
        evidence["file_structure"] = []
        evidence["error"] = str(e)

    print("   📄 Reading critical config files...")
    file_contents = {}
    for filename in CRITICAL_FILES:
        path = REPO_ROOT / filename
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    file_contents[filename] = f.read(4000)
            except Exception:
                file_contents[filename] = "<Error reading file>"
        else:
            file_contents[filename] = "<FILE NOT FOUND>"
            
    evidence["critical_files"] = file_contents
    return evidence


def parse_board(file_path: Path) -> tuple[list[str], list[dict]]:
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    items = []
    for i, line in enumerate(lines):
        match = re.search(r"^\s*-\s*\[([^\]]*)\]\s*(.*)", line)
        if match:
            status_char = match.group(1).strip().lower()
            task_text = match.group(2).strip()
            
            # Skip completed items
            if status_char == 'x':
                continue
                
            items.append({
                "id": i,
                "task": task_text[:150],
                "status": status_char or "empty"
            })
    
    return lines, items


def ask_deepseek_to_verify(commits: list, evidence: dict, board_items: list) -> dict | None:
    check_api_key()
    
    prompt = f"""You are a Senior Tech Lead. Verify the Project Board against the ACTUAL CODEBASE.
    
EVIDENCE 1: RECENT GIT ACTIVITY (Intent/Claims)
{json.dumps(commits[:20], indent=2)}

EVIDENCE 2: ACTUAL CODE STATE (Reality/Proof)
- File Structure (Partial): {json.dumps(evidence['file_structure'][:150])}
- Key Config Files: {json.dumps({k: v[:2000] for k, v in evidence['critical_files'].items()})}

OPEN BOARD ITEMS:
{json.dumps(board_items[:40], indent=2)}

INSTRUCTIONS:
1. VERIFY: Mark items "Completed" ONLY if the CODE EVIDENCE proves it.
   - Example: "Docker Migration" is done if docker-compose.yml exists AND contains postgres
   - Example: "Toast System" is done if ToastContext.tsx exists in file list
2. DETECT GHOST WORK: Identify features in the code that are NOT on the board.
   - Look for new API endpoints, services, components that aren't tracked
3. BE SKEPTICAL: If git says "feat: done" but the file is missing, DO NOT mark as complete.

OUTPUT ONLY VALID JSON:
{{
    "completed_item_ids": [12, 45],
    "ghost_work": [
        {{ "task": "Toast Notification System", "evidence": "Found ToastContext.tsx in contexts/" }},
        {{ "task": "Dark Mode Support", "evidence": "Found ThemeContext.tsx and dark mode CSS" }}
    ]
}}"""
    
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 2000,
    }
    
    try:
        if HTTP_CLIENT == "httpx":
            with httpx.Client(timeout=90) as client:
                response = client.post(DEEPSEEK_API_URL, headers=headers, json=payload)
                response.raise_for_status()
                content = response.json()['choices'][0]['message']['content']
        else:
            response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload, timeout=90)
            response.raise_for_status()
            content = response.json()['choices'][0]['message']['content']
        
        # Parse JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        return json.loads(content.strip())
        
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse LLM response: {e}")
        return None
    except Exception as e:
        print(f"❌ API Error: {e}")
        return None


def update_board(lines: list[str], analysis: dict) -> list[str]:
    """Update board: mark completed items and insert ghost work."""
    
    # 1. Mark Completed Items
    completed_ids = set(analysis.get("completed_item_ids", []))
    for i in range(len(lines)):
        if i in completed_ids:
            lines[i] = re.sub(r"-\s*\[[^\]]*\]", "- [x]", lines[i], count=1)
            print(f"   ✅ Marked Done: Line {i+1}")

    # 2. Insert Ghost Work Section
    ghost_work = analysis.get("ghost_work", [])
    if ghost_work:
        today = datetime.now().strftime("%Y-%m-%d")
        header = f"\n### 👻 Ghost Work Detected ({today})\n"
        header += "> *Untracked features found in codebase by V2 Code-First Reconciler*\n\n"
        
        # Check if section already exists
        ghost_section_idx = None
        for i, line in enumerate(lines):
            if "Ghost Work Detected" in line:
                ghost_section_idx = i
                break
        
        # Build new items
        new_items = []
        existing_content = "".join(lines)
        for item in ghost_work:
            task = item.get('task', 'Unknown')
            evidence = item.get('evidence', 'N/A')
            
            # Avoid duplicates
            if task in existing_content:
                continue
                
            new_items.append(f"- [x] **{task}**\n")
            new_items.append(f"  - Evidence: {evidence}\n")
            print(f"   👻 Added Ghost Work: {task}")
        
        if new_items:
            if ghost_section_idx is not None:
                # Insert after existing header
                insert_point = ghost_section_idx + 2  # Skip header and description
                while insert_point < len(lines) and lines[insert_point].strip().startswith("-"):
                    insert_point += 1
                lines[insert_point:insert_point] = new_items
            else:
                # Find a good insertion point (after "Completed This Sprint" or "In Progress")
                insert_point = len(lines)
                for i, line in enumerate(lines):
                    if "### 🔄 In Progress" in line:
                        insert_point = i
                        break
                
                lines[insert_point:insert_point] = [header] + new_items + ["\n"]
    
    return lines


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="V2 Code-First Reconciler")
    parser.add_argument('--dry-run', action='store_true', help="Don't modify files")
    parser.add_argument('--days', type=int, default=14, help="Git lookback days")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("  V2 Code-First Project Board Reconciler")
    print("  \"Commits are claims, code is truth.\"")
    print("=" * 60)
    
    print("\n👀 Step 1: Scanning ACTUAL Codebase...")
    evidence = scan_codebase_evidence()
    print(f"   Found {evidence.get('total_files', 0)} tracked files")
    
    print(f"\n📜 Step 2: Reading Git History (last {args.days} days)...")
    commits = get_git_commits(args.days)
    print(f"   Found {len(commits)} commits")
    
    print(f"\n📋 Step 3: Parsing Project Board...")
    lines, items = parse_board(BOARD_PATH)
    print(f"   Found {len(items)} incomplete items")
    
    print("\n🧠 Step 4: Verifying with DeepSeek (Code vs Claims)...")
    analysis = ask_deepseek_to_verify(commits, evidence, items)
    
    if not analysis:
        print("❌ Analysis failed. Exiting.")
        return
    
    completed = analysis.get("completed_item_ids", [])
    ghost = analysis.get("ghost_work", [])
    
    print("\n" + "=" * 60)
    print("  VERIFICATION RESULTS")
    print("=" * 60)
    print(f"\n   ✅ Verified Complete: {len(completed)} items")
    print(f"   👻 Ghost Work Found:  {len(ghost)} features")
    
    if args.dry_run:
        print("\n🔍 DRY RUN MODE - No changes made.")
        print(f"   Would mark lines: {completed}")
        for g in ghost:
            print(f"   Would add ghost work: {g.get('task')}")
        return
    
    # Create backup
    backup_path = str(BOARD_PATH) + ".bak"
    shutil.copy(BOARD_PATH, backup_path)
    print(f"\n💾 Backup created: {backup_path}")
    
    # Apply updates
    print("\n📝 Updating PROJECT_BOARD.md...")
    updated_lines = update_board(lines, analysis)
    
    with open(BOARD_PATH, "w", encoding="utf-8") as f:
        f.writelines(updated_lines)
    
    print("\n" + "=" * 60)
    print("  ✨ Board synchronized with code reality!")
    print("=" * 60)


if __name__ == "__main__":
    main()
