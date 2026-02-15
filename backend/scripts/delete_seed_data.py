# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""Delete the seed data created for testing."""

import os
import sys

sys.path.append(os.getcwd())

from app.core.database import SyncSessionLocal
from app.models import Order, ProductionRun, Style

db = SyncSessionLocal()

try:
    # Find and delete the seed order and its production runs
    order = db.query(Order).filter(Order.po_number == "PO-CHART-001").first()
    if order:
        # Delete production runs first
        db.query(ProductionRun).filter(ProductionRun.order_id == order.id).delete()
        # Delete the order
        db.delete(order)

    # Delete the seed style
    style = db.query(Style).filter(Style.style_number == "ST-CHART-001").first()
    if style:
        db.delete(style)

    db.commit()
    print("✅ Seed data deleted successfully")

    # Show remaining data
    remaining_runs = db.query(ProductionRun).count()
    print(f"📊 Remaining production runs in database: {remaining_runs}")

except Exception as e:
    print(f"❌ Error: {e}")
    db.rollback()
finally:
    db.close()
