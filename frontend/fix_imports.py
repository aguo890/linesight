import os
import re
from pathlib import Path

src_dir = Path(r"c:\Users\19803\Projects\FactoryExcelManager\frontend\src")

def resolve_import_path(file_path: Path, relative_import: str) -> str:
    # file_path is something like src/components/ui/Input.tsx
    # relative_import is something like ../../lib/utils
    file_dir = file_path.parent
    try:
        resolved_path = (file_dir / relative_import).resolve()
        # Get path relative to src_dir
        rel_to_src = resolved_path.relative_to(src_dir.resolve())
        # Replace backslashes with forward slashes
        rel_to_src_str = str(rel_to_src).replace('\\', '/')
        return f"@/{rel_to_src_str}"
    except ValueError:
        # If it somehow resolves outside src_dir, just return original
        return relative_import
    except Exception:
        return relative_import

def process_file(file_path: Path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find imports with relative paths
    # Matches: import ... from '../...' or import ... from "../../..."
    # Also matches: export ... from '../...'
    
    pattern = re.compile(r'(from\s+[\'"]|import\s+[\'"])(\.\./[^\'"]+)([\'"])')
    
    def replacer(match):
        prefix = match.group(1)
        rel_import = match.group(2)
        suffix = match.group(3)
        
        new_import = resolve_import_path(file_path, rel_import)
        return f"{prefix}{new_import}{suffix}"

    new_content = pattern.sub(replacer, content)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {file_path.relative_to(src_dir)}")

for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            process_file(Path(root) / file)
