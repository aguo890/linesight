# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
AI-Powered Git Auto-Commit Script
==================================
Uses DeepSeek to generate conventional commit messages from git diff.

Setup:
  1. pip install openai python-dotenv
  2. Add DEEPSEEK_API_KEY to your .env file
  3. Run via: python scripts/autocommit.py
     Or with --quick flag to skip AI analysis

Environment Variables:
  DEEPSEEK_API_KEY - Your DeepSeek API key (get from platform.deepseek.com)
"""
import os
import subprocess
import sys
from pathlib import Path

# Setup paths
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent

# Try multiple .env locations
ENV_LOCATIONS = [
    ROOT_DIR / ".env",
    ROOT_DIR / "backend" / ".env",
]

def load_env():
    """Load environment variables from .env files."""
    try:
        from dotenv import load_dotenv
        for env_path in ENV_LOCATIONS:
            if env_path.exists():
                load_dotenv(env_path)
    except ImportError:
        pass  # dotenv not installed, use system env vars

def get_staged_diff():
    """Get the diff of currently staged files."""
    result = subprocess.run(
        ["git", "diff", "--cached"], 
        capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=ROOT_DIR
    )
    return result.stdout or ""

def get_staged_files():
    """Get the list of staged files."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "--cached"], 
        capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=ROOT_DIR
    )
    return result.stdout or ""

def generate_ai_commit_message(files: str, diff: str, api_key: str) -> str:
    """Generate commit message using DeepSeek API."""
    try:
        from openai import OpenAI
    except ImportError:
        print("⚠️  openai package not installed. Run: pip install openai")
        return None
    
    # Handle large diffs - truncate if necessary
    MAX_DIFF_LEN = 25000  # ~6000-7000 tokens
    
    # Check for lock files
    is_lock_file = any(f.endswith(('.lock', '-lock.json', '.lock.yaml')) for f in files.splitlines())
    
    if is_lock_file:
        diff_context = "⚠️ Large lock file changes detected (excluded to save tokens).\n"
        diff_context += diff[:10000]
    elif len(diff) > MAX_DIFF_LEN:
        diff_context = f"⚠️ DIFF TRUNCATED (Total: {len(diff)} chars). First {MAX_DIFF_LEN}:\n"
        diff_context += diff[:MAX_DIFF_LEN]
    else:
        diff_context = diff

    prompt_content = f"Staged Files:\n{files}\n\nDiff:\n{diff_context}"

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    print("🤖 Generating commit message...")
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": (
                    "You are a senior developer. Generate a commit message using Conventional Commits."
                    "\nStructure:"
                    "\n<type>: <short summary under 72 chars>"
                    "\n\n- <bullet point 1>"
                    "\n- <bullet point 2>"
                    "\n\nRules:"
                    "\n1. First line under 72 chars."
                    "\n2. Group changes logically in bullets."
                    "\n3. No markdown formatting (no **bold**)."
                    "\n4. Types: feat, fix, docs, style, refactor, test, chore"
                )},
                {"role": "user", "content": prompt_content}
            ],
            temperature=0.4,
            max_tokens=250
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"⚠️  AI generation failed: {e}")
        return None

def main():
    load_env()
    
    # Check for --quick flag
    quick_mode = "--quick" in sys.argv
    
    api_key = os.getenv("DEEPSEEK_API_KEY")
    commit_msg = ""

    print("📦 Staging all changes...")
    subprocess.run(["git", "add", "."], cwd=ROOT_DIR)

    diff = get_staged_diff()
    files = get_staged_files()
    
    if not diff.strip():
        print("✨ No changes to commit.")
        sys.exit(0)

    # Generate commit message
    if quick_mode:
        print("⚡ Quick mode - using default message")
        commit_msg = "chore: quick update"
    elif not api_key:
        print("⚠️  DEEPSEEK_API_KEY not found. Using default message.")
        commit_msg = "chore: update (no API key)"
    else:
        commit_msg = generate_ai_commit_message(files, diff, api_key)
        if not commit_msg:
            commit_msg = "chore: update (AI generation failed)"

    # Execute Git Commands
    branch = subprocess.run(
        ["git", "branch", "--show-current"], 
        capture_output=True, text=True, cwd=ROOT_DIR
    ).stdout.strip()
    
    print("---------------------------------------------------")
    print(f"🌿 Branch: {branch}")
    print(f"📝 Message:\n{commit_msg}")
    print("---------------------------------------------------")

    try:
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=ROOT_DIR, check=True)
        subprocess.run(["git", "push"], cwd=ROOT_DIR, check=True)
        print("✅ Pushed successfully!")
    except subprocess.CalledProcessError:
        print("❌ Failed to commit/push.")
        sys.exit(1)

if __name__ == "__main__":
    main()
