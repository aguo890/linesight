#!/bin/bash
# check_banned_patterns.sh
# Zero Tolerance Linter
# Fails if banned patterns are found in the codebase.

BANNED_PATTERNS=(
    "date\.today\(\)"
    "datetime\.now\(\)"
    "ST-999"
    "\"simulation\""
    "\"mock\""
)

# Exclude tests, migrations, and heavy directories
EXCLUDES="--exclude-dir=tests --exclude-dir=alembic --exclude-dir=__pycache__ --exclude-dir=.git --exclude-dir=.venv --exclude-dir=venv --exclude-dir=node_modules --exclude-dir=scripts --exclude-dir=.mypy_cache --exclude=check_banned_patterns.sh --exclude=seed.py"

FAILED=0

echo "Running Zero Tolerance Linter..."

for pattern in "${BANNED_PATTERNS[@]}"; do
    # Search in .py files
    FOUND=$(grep -r $EXCLUDES --include="*.py" "$pattern" . | grep -v "# ignore-linter")
    
    if [ ! -z "$FOUND" ]; then
        echo "e[31m[FAIL] Found banned pattern: $patterne[0m"
        echo "$FOUND"
        FAILED=1
    fi
done

if [ $FAILED -eq 1 ]; then
    echo "e[31mAudit Failed. Please remove banned patterns.e[0m"
    exit 1
else
    echo "e[32mAudit Passed. No banned patterns found.e[0m"
    exit 0
fi
