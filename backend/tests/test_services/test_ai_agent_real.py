import json
import os
import sys

import pandas as pd
from dotenv import load_dotenv

# Add app directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import asyncio

from app.services.llm_agent import CodeExecutionSandbox, SemanticETLAgent


def run_ai_test(csv_path, label):
    # Wrapper to run async function
    asyncio.run(_run_ai_test_async(csv_path, label))


async def _run_ai_test_async(csv_path, label):
    print(f"\n{'=' * 60}")
    print(f"TESTING: {label}")
    print(f"FILE: {csv_path}")
    print(f"{'=' * 60}")

    # Load data
    try:
        # Load everything as strings and don't assume a header
        raw_df = pd.read_csv(csv_path, header=None, dtype=str).fillna("")
        sample_rows = raw_df.values.tolist()
    except Exception as e:
        # Fallback for truly broken CSVs
        print(f"Pandas failed, falling back to manual split: {e}")
        with open(csv_path) as f:
            sample_rows = [line.strip().split(",") for line in f.readlines()]

    agent = SemanticETLAgent()
    sandbox = CodeExecutionSandbox()

    # 1. Infer Schema
    print("\n[Step 1] Inferring Schema...")
    schema = await agent.infer_schema(sample_rows[:20], os.path.basename(csv_path))
    print(f"Header Row: {schema.header_row}")
    print(f"Detected Headers: {schema.detected_headers}")
    print(f"Column Mappings: {json.dumps(schema.column_mappings, indent=2)}")

    # 2. Generate Code
    print("\n[Step 2] Generating Cleaning Code...")
    generated = await agent.generate_cleaning_code(
        schema, "production_runs", sample_rows
    )
    print(f"Generated Code:\n{generated.code}")

    # 3. Execute Code
    print("\n[Step 3] Executing Cleaning Code in Sandbox...")
    try:
        # Use sample_rows converted to a simplistic DF for the test if needed, or just pass a new empty one if sandbox doesn't strictly need it
        # But wait, execute takes (code, df). The generated code likely assumes 'df' is the input dataframe.
        # Let's reconstruct a DataFrame from sample_rows
        df_to_process = pd.DataFrame(sample_rows)
        cleaned_df = sandbox.execute(generated.code, df_to_process)
        print("\n[SUCCESS] Data Cleaned!")
        print("Final Columns:", cleaned_df.columns.tolist())
        print("Sample Data (first 2 rows):")
        print(cleaned_df.head(2).to_string())
    except Exception as e:
        print(f"\n[FAILURE] Execution Error: {e}")


if __name__ == "__main__":
    # Ensure .env is loaded
    load_dotenv()

    data_dir = os.path.join(os.path.dirname(__file__), "../data")

    tests = [
        ("perfect_production.csv", "Level 1: Perfect Data"),
        ("messy_production.csv", "Level 2: Messy Data (Offsets & Formatting)"),
        (
            "ambiguous_production.csv",
            "Level 3: Ambiguous Data (Inconsistent & Missing)",
        ),
    ]

    for filename, label in tests:
        path = os.path.join(data_dir, filename)
        if os.path.exists(path):
            run_ai_test(path, label)
        else:
            print(f"Skipping {filename} - file not found")
