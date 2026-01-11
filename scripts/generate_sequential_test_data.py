
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta, time

def generate_data(start_date, end_date):
    date_range = pd.date_range(start=start_date, end=end_date, freq='D')
    data = []
    
    # Static Configuration
    FACTORY_ID = "FAC-001"
    LINE_ID = "L-10A"
    SHIFT_ABC = ["A", "B", "A", "B"] # Alternating pattern example
    
    # Styles config [Name, SAM, Buyer, Season, Desc]
    styles = [
        ("PANT-202", 15.5, "H&M", "SS25", "Basic Chino"),
        ("SHIRT-55", 12.0, "Zara", "SS25", "Slim Fit Shirt"),
        ("JKT-101", 35.0, "Gap", "FW25", "Denim Jacket")
    ]
    
    current_style_idx = 0
    
    for i, date in enumerate(date_range):
        # 1. Switch Style every ~15 days
        if i > 0 and i % 15 == 0:
            current_style_idx = (current_style_idx + 1) % len(styles)
        
        style = styles[current_style_idx]
        style_code, sam, buyer, season, desc = style
        
        # 2. Workforce & Time Setup
        worker_count = np.random.randint(12, 18) # 12-18 operators
        helpers = max(0, worker_count - 10) # Roughly 1 helper per line if big
        
        # Work hours: mostly 8, sometimes 9 or 10
        hours = np.random.choice([8.0, 9.0, 10.0], p=[0.7, 0.2, 0.1])
        worked_minutes = hours * 60
        
        # 3. Simulate Downtime (10% chance of major breakdown)
        if np.random.random() < 0.1:
            downtime = np.random.randint(30, 120)
            downtime_reason = np.random.choice(["Machine Broken", "Power Failure", "No Fabric"])
        else:
            downtime = np.random.randint(0, 15) # Standard operational loss
            downtime_reason = None
            
        available_minutes = worked_minutes - downtime
        total_man_minutes = available_minutes * (worker_count + helpers)
        
        # 4. Calculate Production based on Efficiency
        # Efficiency usually ramps up during the week? Let's just randomize nicely.
        # Normal distribution centered at 65%, std dev 10%
        efficiency = np.clip(np.random.normal(0.65, 0.10), 0.30, 0.95)
        
        # Theoretical Max = Total Man Mins / SAM
        max_output = total_man_minutes / sam
        actual_output = int(max_output * efficiency)
        
        # Target/Planned is usually aggressive (assume 75% efficiency)
        planned_output = int((total_man_minutes / sam) * 0.75)
        
        # 5. Quality
        # Defect rate ~2-5%
        defect_rate = np.random.uniform(0.01, 0.06) 
        defects = int(actual_output * defect_rate)
        
        if defects > 0:
            dhu = round((defects / actual_output) * 100, 2)
        else:
            dhu = 0.0
            
        # 6. Basic Identifiers
        row = {
            # --- Time ---
            "production_date": date.strftime("%Y-%m-%d"),
            "start_time": "08:00",
            "end_time": f"{8+int(hours)}:00",
            "shift": SHIFT_ABC[i % len(SHIFT_ABC)],
            "downtime_minutes": downtime,
            "downtime_reason": downtime_reason,
            "worked_minutes": worked_minutes,
            
            # --- Identifiers ---
            "line_id": LINE_ID,
            "style_number": style_code,
            "buyer": buyer,
            "season": season,
            "po_number": f"PO-{date.year}-{1000+i}",
            "color": np.random.choice(["Red", "Blue", "Black"]),
            "size": np.random.choice(["S", "M", "L", "XL"]),
            "lot_number": f"LOT-{date.month}-{np.random.randint(10,99)}",
            "batch_number": f"B-{date.day}",
            "notes": desc if i % 7 == 0 else None, # Occasional note
            
            # --- Metrics ---
            "sam": sam,
            "planned_qty": planned_output,
            "actual_qty": actual_output,
            "defects": defects,
            "dhu": dhu,
            "line_efficiency": round(efficiency * 100, 2),
            "earned_minutes": round(actual_output * sam, 2),
            
            # --- Workforce ---
            "operators_present": worker_count,
            "helpers_present": helpers,
            "total_manpower": worker_count + helpers,
        }
        
        data.append(row)
        
    return pd.DataFrame(data)

def main():
    base_dir = os.path.join("backend", "tests", "data")
    os.makedirs(base_dir, exist_ok=True)
    
    files_to_generate = [
        ("Sequential_2025-01.xlsx", "2025-01-01", "2025-01-31"),
        ("Sequential_2025-02.xlsx", "2025-02-01", "2025-02-28"),
        ("Sequential_2025-03.xlsx", "2025-03-01", "2025-03-31"),
    ]
    
    for filename, start, end in files_to_generate:
        print(f"Generating {filename} ({start} to {end})...")
        df = generate_data(start, end)
        output_path = os.path.join(base_dir, filename)
        
        # Ensure we write valid Excel files
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
            
        print(f"Saved to {output_path}")

if __name__ == "__main__":
    main()
