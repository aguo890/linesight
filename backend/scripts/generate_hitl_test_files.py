"""
Generate realistic messy Excel test files for HITL testing.

Creates multiple test files with varying degrees of messiness:
1. Clean - standard column names
2. Abbreviated - common abbreviations (SAM, DHU, Eff%)
3. Typos - common typos and misspellings
4. Synonyms - industry jargon variations
5. Ambiguous - generic column names requiring context

Run: python generate_hitl_test_files.py
"""

import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd


def generate_dates(n_rows: int, start_date: str = "2024-01-01") -> list:
    """Generate realistic production dates."""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    dates = []
    for i in range(n_rows):
        date = start + timedelta(days=i // 3)  # 3 records per day
        dates.append(date.strftime("%Y-%m-%d"))
    return dates


def generate_line_names(n_rows: int) -> list:
    """Generate production line names."""
    lines = ["Line 1", "Line 2", "Line 3", "Sewing A", "Sewing B", "Assembly"]
    return [random.choice(lines) for _ in range(n_rows)]


def generate_production_data(n_rows: int = 50) -> dict:
    """Generate base production data."""
    return {
        "dates": generate_dates(n_rows),
        "lines": generate_line_names(n_rows),
        "output": [random.randint(200, 500) for _ in range(n_rows)],
        "target": [random.randint(400, 550) for _ in range(n_rows)],
        "efficiency": [round(random.uniform(70, 98), 1) for _ in range(n_rows)],
        "sam": [round(random.uniform(0.3, 2.5), 2) for _ in range(n_rows)],
        "dhu": [round(random.uniform(1, 15), 1) for _ in range(n_rows)],
        "style": [f"ST-{random.randint(1000, 9999)}" for _ in range(n_rows)],
        "po": [f"PO-{random.randint(10000, 99999)}" for _ in range(n_rows)],
    }


def create_clean_file(output_dir: Path):
    """Test file 1: Clean, standard column names."""
    data = generate_production_data()
    df = pd.DataFrame(
        {
            "Production Date": data["dates"],
            "Line Name": data["lines"],
            "Production Count": data["output"],
            "Target Quantity": data["target"],
            "Efficiency Percent": data["efficiency"],
            "Standard Allowed Minute": data["sam"],
            "Defects Per Hundred": data["dhu"],
            "Style Number": data["style"],
            "PO Number": data["po"],
        }
    )
    df.to_excel(output_dir / "clean_production.xlsx", index=False)
    print(f"Created: clean_production.xlsx ({len(df)} rows)")


def create_abbreviated_file(output_dir: Path):
    """Test file 2: Abbreviated column names."""
    data = generate_production_data()
    df = pd.DataFrame(
        {
            "Date": data["dates"],
            "Ln": data["lines"],
            "Qty": data["output"],
            "Tgt": data["target"],
            "Eff%": data["efficiency"],
            "SAM": data["sam"],
            "DHU": data["dhu"],
            "Style": data["style"],
            "PO": data["po"],
        }
    )
    df.to_excel(output_dir / "abbreviated_production.xlsx", index=False)
    print(f"Created: abbreviated_production.xlsx ({len(df)} rows)")


def create_typos_file(output_dir: Path):
    """Test file 3: Typos and misspellings."""
    data = generate_production_data()
    df = pd.DataFrame(
        {
            "Prodution Date": data["dates"],  # Typo: missing 'c'
            "Line Nmae": data["lines"],  # Typo: transposed
            "Quantiy": data["output"],  # Typo: missing 't'
            "Traget": data["target"],  # Typo: transposed
            "Effciency": data["efficiency"],  # Typo: missing 'i'
            "Standrd Min": data["sam"],  # Typo: missing 'a'
            "Defect Rat": data["dhu"],  # Typo: truncated
            "Stlye No": data["style"],  # Typo: transposed
            "PO Numb": data["po"],  # Typo: truncated
        }
    )
    df.to_excel(output_dir / "typos_production.xlsx", index=False)
    print(f"Created: typos_production.xlsx ({len(df)} rows)")


def create_synonyms_file(output_dir: Path):
    """Test file 4: Industry synonyms and jargon."""
    data = generate_production_data()
    df = pd.DataFrame(
        {
            "Work Date": data["dates"],
            "Sewing Line": data["lines"],
            "Pieces": data["output"],
            "Daily Target": data["target"],
            "Line Performance": data["efficiency"],
            "SMV": data["sam"],  # Standard Minute Value
            "Fail Rate": data["dhu"],  # Quality jargon
            "SKU": data["style"],  # Retail term
            "Purchase Order": data["po"],
        }
    )
    df.to_excel(output_dir / "synonyms_production.xlsx", index=False)
    print(f"Created: synonyms_production.xlsx ({len(df)} rows)")


def create_ambiguous_file(output_dir: Path):
    """Test file 5: Ambiguous generic column names."""
    data = generate_production_data()
    df = pd.DataFrame(
        {
            "Date": data["dates"],
            "ID": data["lines"],  # Could be anything
            "Value": data["output"],  # Could be anything
            "Target": data["target"],
            "Rate": data["efficiency"],  # Efficiency? DHU?
            "Time": data["sam"],  # SAM? Timestamp?
            "Percentage": data["dhu"],  # DHU? Efficiency?
            "Code": data["style"],  # Style? PO?
            "Reference": data["po"],  # Could be anything
        }
    )
    df.to_excel(output_dir / "ambiguous_production.xlsx", index=False)
    print(f"Created: ambiguous_production.xlsx ({len(df)} rows)")


def create_mixed_quality_file(output_dir: Path):
    """Test file 6: Mixed quality with some null values."""
    data = generate_production_data(30)

    # Introduce some null values
    for _i in range(5):
        idx = random.randint(0, 29)
        data["sam"][idx] = None
        data["dhu"][idx] = None

    df = pd.DataFrame(
        {
            "Prod_Date": data["dates"],
            "Line": data["lines"],
            "Output": data["output"],
            "Goal": data["target"],
            "Eff": data["efficiency"],
            "Sewing_Allowance": data["sam"],  # Industry term for SAM
            "Defect_Rate": data["dhu"],
            "Item_No": data["style"],
            "Order_No": data["po"],
            "Notes": ["" for _ in range(30)],  # Empty column
        }
    )
    df.to_excel(output_dir / "mixed_quality_production.xlsx", index=False)
    print(f"Created: mixed_quality_production.xlsx ({len(df)} rows, with nulls)")


if __name__ == "__main__":
    output_dir = Path(__file__).parent / "test_data"
    output_dir.mkdir(exist_ok=True)

    print("Generating HITL test files...")
    print("=" * 50)

    create_clean_file(output_dir)
    create_abbreviated_file(output_dir)
    create_typos_file(output_dir)
    create_synonyms_file(output_dir)
    create_ambiguous_file(output_dir)
    create_mixed_quality_file(output_dir)

    print("=" * 50)
    print(f"All files created in: {output_dir}")
