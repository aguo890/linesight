import ast
import os
import sys

import stdlib_list

# Map import names to package names where they differ
PACKAGE_MAPPING = {
    "dotenv": "python-dotenv",
    "jose": "python-jose",
    "multipart": "python-multipart",
    "socketio": "python-socketio",
    "yaml": "PyYAML",
    "bs4": "beautifulsoup4",
    "cv2": "opencv-python",
    "PIL": "Pillow",
    "sklearn": "scikit-learn",
    "skimage": "scikit-image",
    "presidio_analyzer": "presidio-analyzer",
    "presidio_anonymizer": "presidio-anonymizer",
    "factory": "polyfactory",  # checking mismatch
}


def get_stdlib_modules():
    # Attempt to get stdlib modules for the current python version
    version = f"{sys.version_info.major}.{sys.version_info.minor}"
    try:
        return set(stdlib_list.stdlib_list(version))
    except ValueError:
        # Fallback to a recent version if exact match fails
        return set(stdlib_list.stdlib_list("3.10"))


def get_imports_from_file(filepath):
    with open(filepath, encoding="utf-8") as f:
        try:
            tree = ast.parse(f.read(), filename=filepath)
        except SyntaxError:
            return set()

    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])
    return imports


def scan_directory(root_dir):
    all_imports = set()
    for root, _dirs, files in os.walk(root_dir):
        if "venv" in root or "__pycache__" in root or ".git" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                imports = get_imports_from_file(path)
                all_imports.update(imports)
    return all_imports


def parse_requirements(req_path):
    requirements = set()
    if not os.path.exists(req_path):
        return requirements

    with open(req_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # Handle standard requirements format
            # Split by version specifiers like ==, >=, etc.
            import re

            parts = re.split(r"[<>=!]", line)
            pkg = parts[0].strip().lower()
            # Handle [extra] syntax
            pkg = pkg.split("[")[0]
            requirements.add(pkg)
    return requirements


def main():
    root_dir = os.getcwd()  # Run from backend root
    req_path = os.path.join(root_dir, "requirements.txt")

    print(f"Scanning imports in {root_dir}...")
    code_imports = scan_directory(root_dir)

    # Filter stdlib
    stdlib = get_stdlib_modules()
    # Add some common built-ins that might be missed or specific to the env
    stdlib.update({"app", "tests", "scripts", "alembic"})

    third_party_imports = {imp for imp in code_imports if imp not in stdlib}

    # Map imports to typical package names
    mapped_imports = set()
    for imp in third_party_imports:
        pkg = PACKAGE_MAPPING.get(imp, imp)
        mapped_imports.add(pkg.lower())

    print(f"Found {len(mapped_imports)} third-party imports (after mapping).")

    print(f"Reading requirements from {req_path}...")
    requirements = parse_requirements(req_path)

    missing = []
    for imp in mapped_imports:
        # Check direct match or hyphens vs underscores
        if imp not in requirements and imp.replace("_", "-") not in requirements:
            # Check if it's covered by a known package that provides it
            # (Simplified check)
            missing.append(imp)

    if missing:
        print("\nPossible MISSING dependencies:")
        for m in sorted(missing):
            print(f"  - {m}")
    else:
        print("\nAll imports appear to be covered by requirements.txt!")


if __name__ == "__main__":
    # We might need to install stdlib-list for this script to work perfectly,
    # but we can try running it. If it fails on missing stdlib-list, I'll mock the stdlist.
    try:
        import stdlib_list

        main()
    except ImportError:
        print("Installing stdlib-list for audit script...")
        os.system("pip install stdlib-list")
        import stdlib_list

        main()
