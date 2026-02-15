# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import os
from datetime import datetime, timedelta

import pandas as pd


def create_golden_master():
    # Define base data
    base_date = datetime(2025, 1, 1).date()  # Start on a Wednesday

    # Scenarios
    data = []

    # Scenario 1: Perfect Day - High Efficiency, No Defects
    # Style: ST-001, Order: PO-1001
    data.append(
        {
            "production_date": base_date,
            "shift": "Day",
            "style_number": "ST-001",
            "style_description": "Basic T-Shirt",
            "po_number": "PO-1001",
            "buyer": "Gap",
            "season": "Summer 25",
            "quantity": 1000,
            "sam": 5.0,  # 5 mins per piece
            "planned_qty": 100,
            "actual_qty": 100,  # 100 * 5 = 500 earned mins
            "operators_present": 10,
            "helpers_present": 0,
            "worked_minutes": 50,  # 10 * 50 = 500 available mins
            "downtime_minutes": 0,
            "downtime_reason": None,
            "defects": 0,
            "dhu": 0.0,
        }
    )

    # Scenario 2: Quality Issues - High Defects
    # Style: ST-001, Order: PO-1001 (Same Order)
    data.append(
        {
            "production_date": base_date + timedelta(days=1),
            "shift": "Day",
            "style_number": "ST-001",
            "style_description": "Basic T-Shirt",
            "po_number": "PO-1001",
            "buyer": "Gap",
            "season": "Summer 25",
            "quantity": 1000,
            "sam": 5.0,
            "planned_qty": 100,
            "actual_qty": 90,  # 10 defects
            "operators_present": 10,
            "helpers_present": 0,
            "worked_minutes": 50,
            "downtime_minutes": 0,
            "downtime_reason": None,
            "defects": 10,
            "dhu": 11.1,  # 10/90 * 100 approx
        }
    )

    # Scenario 3: Downtime Event - Machine Failure
    # Style: ST-002, Order: PO-2002
    data.append(
        {
            "production_date": base_date + timedelta(days=2),
            "shift": "Day",
            "style_number": "ST-002",
            "style_description": "Denim Jeans",
            "po_number": "PO-2002",
            "buyer": "Levis",
            "season": "Winter 24",
            "quantity": 500,
            "sam": 15.0,
            "planned_qty": 50,
            "actual_qty": 20,  # Low output due to downtime
            "operators_present": 10,
            "helpers_present": 2,  # Total 12
            "worked_minutes": 60,  # 12 * 60 = 720 available
            "downtime_minutes": 30,
            "downtime_reason": "Needle Breakage",
            "defects": 0,
            "dhu": 0.0,
        }
    )

    # Scenario 4: Mixed Styles - Two styles in same day/shift (Line mismatch simulation or split line)
    # Actually, our model assumes 1 Run per Order/Date/Shift per Line.
    # To simulate mixed styles, we just add another row for same date/shift but different order/style.

    # Sub-scenario 4a
    data.append(
        {
            "production_date": base_date + timedelta(days=3),
            "shift": "Day",
            "style_number": "ST-001",
            "po_number": "PO-1001",
            "quantity": 1000,
            "sam": 5.0,
            "planned_qty": 50,
            "actual_qty": 50,
            "operators_present": 5,
            "helpers_present": 0,
            "worked_minutes": 60,
            "downtime_minutes": 0,
            "downtime_reason": None,
            "defects": 1,
            "dhu": 2.0,
        }
    )

    # Sub-scenario 4b
    data.append(
        {
            "production_date": base_date + timedelta(days=3),
            "shift": "Day",
            "style_number": "ST-002",
            "po_number": "PO-2002",
            "quantity": 500,
            "sam": 15.0,
            "planned_qty": 20,
            "actual_qty": 20,
            "operators_present": 5,
            "helpers_present": 0,
            "worked_minutes": 60,
            "downtime_minutes": 0,
            "downtime_reason": None,
            "defects": 0,
            "dhu": 0.0,
        }
    )

    # Scenario 5: Partial Shift / Late Entry (Workforce data gap simulation - implicit)
    # Style: ST-003, Order: PO-3003
    data.append(
        {
            "production_date": base_date + timedelta(days=4),
            "shift": "Day",
            "style_number": "ST-003",
            "style_description": "Silk Dress",
            "po_number": "PO-3003",
            "buyer": "ZARA",
            "season": "Spring 25",
            "quantity": 200,
            "sam": 25.0,
            "planned_qty": 10,
            "actual_qty": 8,
            "operators_present": 4,  # Supposed to be 5
            "helpers_present": 1,
            "worked_minutes": 30,  # Half shift
            "downtime_minutes": 0,
            "downtime_reason": None,
            "defects": 0,
            "dhu": 0.0,
        }
    )

    df = pd.DataFrame(data)
    print("DEBUG: Generated DataFrame Head:")
    print(df.head())
    print(f"DEBUG: Columns: {df.columns.tolist()}")

    # Ensure directory exists
    os.makedirs("backend/tests/fixtures", exist_ok=True)

    # Save
    file_path = "backend/tests/fixtures/golden_master_production.xlsx"
    df.to_excel(file_path, index=False)
    print(f"Golden Master created at: {os.path.abspath(file_path)}")


if __name__ == "__main__":
    create_golden_master()
