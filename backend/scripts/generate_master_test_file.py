import os
from datetime import date, timedelta

import pandas as pd

# Define the Master columns based on `widget_data_requirements.md` and `types.py`
data = {
    # Identifiers
    "style_number": ["ST-001", "ST-002", "ST-001", "ST-003", "ST-002"],
    "po_number": ["PO-1001", "PO-1002", "PO-1001", "PO-1003", "PO-1002"],
    "buyer": ["Client A", "Client B", "Client A", "Client C", "Client B"],
    # Time
    "production_date": [
        date.today(),
        date.today(),
        date.today() - timedelta(days=1),
        date.today() - timedelta(days=2),
        date.today() - timedelta(days=3),
    ],
    "shift": ["A", "A", "A", "B", "A"],
    # Metrics (Core for Widgets)
    "actual_qty": [
        450,
        300,
        500,
        480,
        200,
    ],  # Target Realization, Style Progress, Earned Minutes
    "planned_qty": [500, 350, 500, 500, 350],  # Target Realization (CRITICAL)
    # Efficiency & Complexity (Complexity Impact, Speed vs Quality)
    "sam": [15.5, 20.0, 15.5, 12.0, 20.0],  # Complexity Impact X-Axis
    "worked_minutes": [480, 480, 480, 480, 480],  # Denominator for Efficiency
    "operators_present": [10, 8, 10, 12, 8],  # Denominator for Efficiency
    "helpers_present": [2, 1, 2, 2, 1],  # Denominator for Efficiency
    # Quality (Speed vs Quality)
    "defects": [5, 12, 2, 8, 0],  # Speed vs Quality Line
    "dhu": [1.1, 4.0, 0.4, 1.6, 0.0],  # Alternative for Quality
    # Downtime (Blocker Cloud - NEWLY ENABLED)
    "downtime_minutes": [30, 0, 15, 45, 0],  # Blocker Cloud Weight
    "downtime_reason": [
        "Machine Breakdown",
        None,
        "Material Shortage",
        "Power Failure",
        None,
    ],  # Blocker Cloud Label
    # Validation/Metadata
    "notes": ["Heavy rain", "New style start", "", "Generator issue", "Perfect day"],
}

df = pd.DataFrame(data)

# Ensure directory exists
output_dir = r"c:\Users\19803\business\FactoryExcelManager\backend\test_data"
os.makedirs(output_dir, exist_ok=True)

output_path = os.path.join(output_dir, "Master_Widget_Test_Data.xlsx")
df.to_excel(output_path, index=False)

print(f"Generated Master Test File at: {output_path}")
print("Columns included:")
for col in df.columns:
    print(f" - {col}")
