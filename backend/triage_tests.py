import re
from collections import Counter

def analyze_failures(log_file="test_output.txt"):
    try:
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ File {log_file} not found.")
        return

    # Regex to find failure patterns
    errors = re.findall(r"E \s+(.*?Error): (.*)", content)
    
    if not errors:
        print("✅ No obvious python exceptions found in log (or log format differs).")
        return

    print(f"📉 Found {len(errors)} total errors.\n")
    
    # Group by Error Type
    error_counts = Counter(e[0] for e in errors)
    print("📊 Failure Categories:")
    for err_type, count in error_counts.most_common():
        print(f"  - {err_type}: {count}")

    print("\n🔍 Top 3 Unique Error Messages:")
    unique_msgs = Counter(f"{e[0]}: {e[1]}" for e in errors)
    for msg, count in unique_msgs.most_common(3):
        print(f"  - [{count}x] {msg}")

    # Strategic Advice based on findings
    print("\n💡 STRATEGY RECOMMENDATION:")
    if error_counts["ModuleNotFoundError"] > 5 or error_counts["ImportError"] > 5:
        print("  👉 MAJOR REFACTOR DETECTED: You deleted/moved files but tests still import them.")
        print("     ACTION: Delete the test files that import missing modules/OR Update imports if refactored.")
    elif error_counts["OperationalError"] > 0 or error_counts["ConnectionRefusedError"] > 0:
        print("  👉 DB CONFIG ISSUE: Tests can't connect to the database.")
        print("     ACTION: Fix 'conftest.py' or check your .env file for testing.")
    elif error_counts["AssertionError"] > 10:
        print("  👉 LOGIC CHANGE: The code works, but outputs changed (e.g., HTTP 201 vs 200).")
        print("     ACTION: Update the test expectations to match new reality.")

if __name__ == "__main__":
    analyze_failures()
