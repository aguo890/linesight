import os
import subprocess
import sys
from pathlib import Path

# Setup paths (needed for reliable cwd usage)
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
BACKEND_ENV = ROOT_DIR / "backend" / ".env"

# Try to import required packages
try:
    from dotenv import load_dotenv
    from openai import OpenAI
except ImportError:
    # If run outside venv or missing deps
    print("⚠️  Missing dependencies (openai, python-dotenv).")
    print("   Falling back to default message and standard git commands.")
    # Fix: Use cwd=ROOT_DIR to ensure we add files from the project root, not script dir
    subprocess.run(["git", "add", "."], cwd=ROOT_DIR)
    subprocess.run(["git", "commit", "-m", "wip: quick push (missing deps)"], cwd=ROOT_DIR)
    subprocess.run(["git", "push"], cwd=ROOT_DIR)
    sys.exit(0)

# Load environment variables
load_dotenv(BACKEND_ENV)
load_dotenv(ROOT_DIR / ".env")

def get_staged_diff():
    """Get the diff of currently staged files."""
    # Force utf-8 encoding to handle emojis/special chars on Windows
    result = subprocess.run(
        ["git", "diff", "--cached"], 
        capture_output=True, 
        text=True, 
        encoding='utf-8', 
        errors='replace', 
        cwd=ROOT_DIR
    )
    return result.stdout or ""

def get_staged_files():
    """Get the list of staged files."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "--cached"], 
        capture_output=True, 
        text=True, 
        encoding='utf-8', 
        errors='replace', 
        cwd=ROOT_DIR
    )
    return result.stdout or ""

def main():
    api_key = os.getenv("DEEPSEEK_API_KEY")
    commit_msg = ""

    # 1. Stage Everything Immediately
    # Since this is a 'quick push', we assume the user wants to commit everything.
    # We do this FIRST so the diff includes untracked (new) files.
    print("📦 Staging all changes...")
    subprocess.run(["git", "add", "."], cwd=ROOT_DIR)

    # 2. Get Diff & Files
    diff = get_staged_diff()
    files = get_staged_files()
    
    if not diff.strip():
        print("No changes to commit.")
        sys.exit(0)

    # 3. Generate Message
    if not api_key:
        print("⚠️  DeepSeek API Key not found. Using default message.")
        commit_msg = "wip: quick push (missing api key)"
    else:
        # Truncate diff to prevent token limits/costs
        diff_context = diff[:4000] 
        
        # Add file list to context for better awareness
        prompt_content = f"Files changed:\n{files}\n\nDiff:\n{diff_context}"

        client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )

        print("🤖 Generating commit message...")
        
        try:
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": "You are a git commit assistant. Generate a concise, one-line commit message based on the following changes. Start with a verb (e.g., 'Fix', 'Add', 'Update'). Mention specific file names or components if relevant. Do not use markdown or quotes."},
                    {"role": "user", "content": prompt_content}
                ],
                temperature=0.5,
                max_tokens=80
            )
            commit_msg = response.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️  Generation failed: {e}")
            commit_msg = "wip: quick push (generation failed)"

    # 4. Execute Git Commands (Commit & Push)
    # 4. Execute Git Commands (Commit & Push)
    # Get current branch for sanity check
    branch = subprocess.run(
        ["git", "branch", "--show-current"], 
        capture_output=True, 
        text=True, 
        encoding='utf-8', 
        cwd=ROOT_DIR
    ).stdout.strip()
    print(f"🚀 Committing to branch '{branch}' with message: '{commit_msg}'")
    
    # Note: We already ran 'git add .' at the start of main()
    
    try:
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=ROOT_DIR, check=True)
        subprocess.run(["git", "push"], cwd=ROOT_DIR, check=True)
        print("✅ Pushed!")
    except subprocess.CalledProcessError:
        print("❌ Failed to commit/push.")
        sys.exit(1)

if __name__ == "__main__":
    main()
