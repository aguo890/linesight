# Task: Implement "Smart Push" Workflow

Please implement a "Smart Push" workflow for this project. This workflow automates two things:
1.  **Project Board Reconciliation**: Verifies that tasks marked "In Progress" or "Done" on the project board are backed by actual code evidence, and detects "Ghost Work" (untracked features).
2.  **Auto-Commit**: Generates semantic commit messages based on staged changes using an LLM.

## 1. Create `scripts/reconcile/reconcile_board.py`
Create this script to cross-reference the `PROJECT_BOARD.md` with the git history and file structure.

```python
#!/usr/bin/env python3
"""
V2 Code-First Project Board Reconciler - AUTO-UPDATE MODE
marks verified tasks as done, inserts ghost work, backups board.
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
# ADAPT THIS PATH TO YOUR PROJECT BOARD LOCATION
BOARD_PATH = REPO_ROOT / "PROJECT_BOARD.md"
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# ADAPT THIS LIST TO YOUR PROJECT'S CRITICAL CONFIG FILES
CRITICAL_FILES = [
    "docker-compose.yml",
    "Makefile",
    "package.json",
    "requirements.txt",
    "pyproject.toml",
]

# ADAPT THIS LIST TO YOUR PROJECT'S SOURCE FOLDERS
FILE_TREE_PREFIXES = [
    "src/",
    "app/",
    "lib/",
    "components/",
    "api/",
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
        return [line.strip() for line in result.stdout.strip().split("\\n") if line.strip()]
    except Exception as e:
        print(f"⚠️  Git log error: {e}")
        return []

def scan_codebase_evidence() -> dict:
    evidence = {}
    print("   📂 Scanning file structure...")
    try:
        result = subprocess.run("git ls-files", cwd=str(REPO_ROOT), capture_output=True, text=True, shell=True)
        all_files = result.stdout.strip().split("\\n")
        
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
        match = re.search(r"^\\s*-\\s*\\[([^\\]]*)\\]\\s*(.*)", line)
        if match:
            status_char = match.group(1).strip().lower()
            task_text = match.group(2).strip()
            if status_char == 'x': continue
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
    2. DETECT GHOST WORK: Identify features in the code that are NOT on the board.
    3. BE SKEPTICAL: If git says "feat: done" but the file is missing, DO NOT mark as complete.
    
    OUTPUT ONLY VALID JSON:
    {{
        "completed_item_ids": [12, 45],
        "ghost_work": [
            {{ "task": "Toast Notification System", "evidence": "Found ToastContext.tsx" }}
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
        
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return json.loads(content.strip())
    except Exception as e:
        print(f"❌ API Error: {e}")
        return None

def update_board(lines: list[str], analysis: dict) -> list[str]:
    completed_ids = set(analysis.get("completed_item_ids", []))
    for i in range(len(lines)):
        if i in completed_ids:
            lines[i] = re.sub(r"-\\s*\\[[^\\]]*\\]", "- [x]", lines[i], count=1)
            print(f"   ✅ Marked Done: Line {i+1}")

    ghost_work = analysis.get("ghost_work", [])
    if ghost_work:
        today = datetime.now().strftime("%Y-%m-%d")
        header = f"\\n### 👻 Ghost Work Detected ({{today}})\\n> *Untracked features found in codebase*\\n\\n"
        
        ghost_section_idx = None
        for i, line in enumerate(lines):
            if "Ghost Work Detected" in line:
                ghost_section_idx = i
                break
        
        new_items = []
        existing_content = "".join(lines)
        for item in ghost_work:
            task = item.get('task', 'Unknown')
            evidence = item.get('evidence', 'N/A')
            if task in existing_content: continue
            new_items.append(f"- [x] **{{task}}**\\n")
            new_items.append(f"  - Evidence: {{evidence}}\\n")
            print(f"   👻 Added Ghost Work: {{task}}")
        
        if new_items:
            if ghost_section_idx is not None:
                insert_point = ghost_section_idx + 2
                while insert_point < len(lines) and lines[insert_point].strip().startswith("-"):
                    insert_point += 1
                lines[insert_point:insert_point] = new_items
            else:
                lines.append(header)
                lines.extend(new_items)
                lines.append("\\n")
    return lines

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--days', type=int, default=14)
    args = parser.parse_args()
    
    print("👀 Scanning Codebase...")
    evidence = scan_codebase_evidence()
    print("📜 Reading Git History...")
    commits = get_git_commits(args.days)
    print("📋 Parsing Project Board...")
    lines, items = parse_board(BOARD_PATH)
    print("🧠 Verifying with DeepSeek...")
    analysis = ask_deepseek_to_verify(commits, evidence, items)
    
    if not analysis: return
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes made.")
        print(f"   Completed: {analysis.get('completed_item_ids')}")
        return

    backup_path = str(BOARD_PATH) + ".bak"
    shutil.copy(BOARD_PATH, backup_path)
    lines = update_board(lines, analysis)
    with open(BOARD_PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("✨ Board synchronized!")

if __name__ == "__main__":
    main()
```

## 2. Create `scripts/autocommit.py`
Create this script to handle git staging, message generation, and pushing.

```python
import os
import subprocess
import sys
from pathlib import Path

# Setup paths
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent

try:
    from dotenv import load_dotenv
    from openai import OpenAI
except ImportError:
    print("⚠️  Missing dependencies (openai, python-dotenv).")
    subprocess.run(["git", "add", "."], cwd=ROOT_DIR)
    subprocess.run(["git", "commit", "-m", "wip: quick push (missing deps)"], cwd=ROOT_DIR)
    subprocess.run(["git", "push"], cwd=ROOT_DIR)
    sys.exit(0)

load_dotenv(ROOT_DIR / ".env")

def get_staged_diff():
    result = subprocess.run(["git", "diff", "--cached"], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=ROOT_DIR)
    return result.stdout or ""

def get_staged_files():
    result = subprocess.run(["git", "diff", "--name-only", "--cached"], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=ROOT_DIR)
    return result.stdout or ""

def main():
    api_key = os.getenv("DEEPSEEK_API_KEY") # Or OPENAI_API_KEY
    commit_msg = ""

    print("📦 Staging all changes...")
    subprocess.run(["git", "add", "."], cwd=ROOT_DIR)

    diff = get_staged_diff()
    files = get_staged_files()
    
    if not diff.strip():
        print("No changes to commit.")
        sys.exit(0)

    if not api_key:
        print("⚠️  API Key not found. Using default message.")
        commit_msg = "wip: quick push (missing api key)"
    else:
        MAX_DIFF_LEN = 25000 
        is_lock_file = any(f.endswith(('.lock', '-lock.json', '.lock.yaml')) for f in files.splitlines())
        
        if is_lock_file:
            diff_context = "⚠️ Large lock file changes detected (excluded)." + "\\n" + diff[:10000]
        elif len(diff) > MAX_DIFF_LEN:
            diff_context = f"⚠️ DIFF TRUNCATED. Showing first {{MAX_DIFF_LEN}} chars:\\n" + diff[:MAX_DIFF_LEN]
        else:
            diff_context = diff

        prompt_content = f"Staged Files:\\n{{files}}\\n\\nDiff Content:\\n{{diff_context}}"
        
        # Adjust base_url/model if using standard OpenAI
        client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

        print("🤖 Generating commit message...")
        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "Generate a Conventional Commit message. First line under 72 chars. Use bullet points for details. No markdown formatting in output."},
                    {"role": "user", "content": prompt_content}
                ],
                temperature=0.4,
                max_tokens=250
            )
            commit_msg = response.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️  Generation failed: {{e}}")
            commit_msg = "wip: large update"

    print(f"🚀 Committing: {{commit_msg}}")
    try:
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=ROOT_DIR, check=True)
        subprocess.run(["git", "push"], cwd=ROOT_DIR, check=True)
        print("✅ Pushed!")
    except subprocess.CalledProcessError:
        print("❌ Failed to commit/push.")
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## 3. Update `Makefile`
Add these targets to your Makefile:

```makefile
# Variables
PYTHON_CMD ?= python3

.PHONY: push reconcile-dry

# Reconcile Board (Dry Run) - Checks board against code
reconcile-dry:
	@echo "🔍 Reconciling Board (Dry Run)..."
	@$(PYTHON_CMD) scripts/reconcile/reconcile_board.py --dry-run

# Smart Push - Reconciles then Commits
push: reconcile-dry
	@echo "✅ Board verified. Running smart push..."
	@$(PYTHON_CMD) scripts/autocommit.py
```

## 4. Final Setup
1.  Ensure `DEEPSEEK_API_KEY` (or `OPENAI_API_KEY`) is in your `.env`.
2.  Install requirements: `pip install openai python-dotenv requests` (or add to `requirements.txt`).
3.  Run `make push` to test!
