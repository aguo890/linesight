import os
import random
from datetime import date, datetime, timedelta

import pandas as pd


def generate_bulk_data(
    days=90, start_date_str=None, end_date_str=None, output_dir="backend/test_data_bulk"
):
    """Generates synthetic production data for the last N days or a specific range."""

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Configuration
    styles = [
        {"style_number": "ST-001", "buyer": "Client A", "sam": 15.5},
        {"style_number": "ST-002", "buyer": "Client B", "sam": 20.0},
        {"style_number": "ST-003", "buyer": "Client C", "sam": 12.0},
        {"style_number": "ST-004", "buyer": "Client A", "sam": 18.0},
        {"style_number": "ST-005", "buyer": "Client D", "sam": 22.5},
    ]

    pos_per_style = 3
    lines = ["Line-01", "Line-02", "Line-03", "Line-04"]
    shifts = ["A", "B"]

    # Date Logic
    if start_date_str and end_date_str:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        date_range_days = (end_date - start_date).days
    else:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        date_range_days = days

    print(
        f"📅 Generating data from {start_date} to {end_date} ({date_range_days} days)"
    )

    all_records = []

    for day_offset in range(date_range_days + 1):
        current_date = start_date + timedelta(days=day_offset)

        # Skip or reduce production on Sundays (optional, but realistic)
        is_weekend = current_date.weekday() >= 5
        if is_weekend and random.random() > 0.2:
            continue

        for line in lines:
            for shift in shifts:
                # Pick a random style and PO
                style = random.choice(styles)
                po_index = random.randint(1, pos_per_style)
                po_number = f"PO-{style['style_number']}-{po_index}"

                # Production Metrics
                planned_qty = random.randint(300, 600)
                # Actual qty usually close to planned, but with variance
                actual_qty = int(planned_qty * random.uniform(0.7, 1.1))

                # Manpower
                operators = random.randint(8, 15)
                helpers = random.randint(1, 4)
                worked_minutes = 480  # Standard 8 hour shift

                # Quality
                defects = random.randint(0, int(actual_qty * 0.05))
                dhu = round((defects / actual_qty * 100), 2) if actual_qty > 0 else 0

                # Downtime/Blockers
                downtime_minutes = 0
                downtime_reason = None
                if random.random() < 0.15:  # 15% chance of a blocker
                    downtime_minutes = random.randint(15, 120)
                    downtime_reason = random.choice(
                        [
                            "Machine Breakdown",
                            "Material Shortage",
                            "Power Failure",
                            "Thread Breakage",
                            "Needle Change",
                        ]
                    )

                record = {
                    "style_number": style["style_number"],
                    "po_number": po_number,
                    "buyer": style["buyer"],
                    "production_date": current_date,
                    "shift": shift,
                    "line_name": line,
                    "actual_qty": actual_qty,
                    "planned_qty": planned_qty,
                    "sam": style["sam"],
                    "worked_minutes": worked_minutes,
                    "operators_present": operators,
                    "helpers_present": helpers,
                    "defects": defects,
                    "dhu": dhu,
                    "downtime_minutes": downtime_minutes,
                    "downtime_reason": downtime_reason,
                    "notes": "Generated bulk test data",
                }
                all_records.append(record)

    df = pd.DataFrame(all_records)

    # Save as one big file or multiple?
    # Let's save one big file and maybe a few smaller ones split by month.

    master_filename = f"Bulk_Production_{start_date}_{end_date}.xlsx"
    master_path = os.path.join(output_dir, master_filename)
    df.to_excel(master_path, index=False)
    print(f"✅ Generated Master Bulk File: {master_path} ({len(df)} records)")

    # Also save by month
    for month in df["production_date"].apply(lambda x: x.strftime("%Y-%m")).unique():
        month_df = df[
            df["production_date"].apply(lambda x: x.strftime("%Y-%m")) == month
        ]
        month_path = os.path.join(output_dir, f"Production_{month}.xlsx")
        month_df.to_excel(month_path, index=False)
        print(f"✅ Generated Monthly File: {month_path} ({len(month_df)} records)")


if __name__ == "__main__":
    # Adjust path if needed to run from root or scripts dir
    # Requested: Oct 3, 2025 to Jan 3, 2026
    generate_bulk_data(start_date_str="2025-10-03", end_date_str="2026-01-03")
