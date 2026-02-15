# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

#!/usr/bin/env python
"""Quick cleanup script for test factories."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text

from app.core.database import SyncSessionLocal

FACTORY_NAME_PREFIX = "LineSight Test Factory"

db = SyncSessionLocal()
try:
    # Find test factory IDs
    result = db.execute(
        text(f"SELECT id FROM factories WHERE name LIKE '{FACTORY_NAME_PREFIX}%'")
    )
    factory_ids = [r[0] for r in result.fetchall()]

    if not factory_ids:
        print("No test factories found")
    else:
        for fac_id in factory_ids:
            print(f"Cleaning up factory: {fac_id}")

            # Get line IDs
            lines = db.execute(
                text(f"SELECT id FROM production_lines WHERE factory_id = '{fac_id}'")
            ).fetchall()
            line_ids = [line_row[0] for line_row in lines]

            for line_id in line_ids:
                print(f"  Deleting line data: {line_id}")
                db.execute(
                    text(
                        f"DELETE FROM data_sources WHERE production_line_id = '{line_id}'"
                    )
                )
                db.execute(
                    text(f"DELETE FROM production_events WHERE line_id = '{line_id}'")
                )

            # Get style IDs
            styles = db.execute(
                text(f"SELECT id FROM styles WHERE factory_id = '{fac_id}'")
            ).fetchall()

            for style_row in styles:
                style_id = style_row[0]
                orders = db.execute(
                    text(f"SELECT id FROM orders WHERE style_id = '{style_id}'")
                ).fetchall()

                for order_row in orders:
                    order_id = order_row[0]
                    runs = db.execute(
                        text(
                            f"SELECT id FROM production_runs WHERE order_id = '{order_id}'"
                        )
                    ).fetchall()

                    for run_row in runs:
                        run_id = run_row[0]
                        db.execute(
                            text(
                                f"DELETE FROM quality_inspections WHERE production_run_id = '{run_id}'"
                            )
                        )
                        db.execute(
                            text(
                                f"DELETE FROM efficiency_metrics WHERE production_run_id = '{run_id}'"
                            )
                        )
                        db.execute(
                            text(
                                f"DELETE FROM production_events WHERE production_run_id = '{run_id}'"
                            )
                        )

                    db.execute(
                        text(
                            f"DELETE FROM production_runs WHERE order_id = '{order_id}'"
                        )
                    )

                db.execute(text(f"DELETE FROM orders WHERE style_id = '{style_id}'"))

            db.execute(text(f"DELETE FROM styles WHERE factory_id = '{fac_id}'"))
            db.execute(
                text(f"DELETE FROM production_lines WHERE factory_id = '{fac_id}'")
            )
            db.execute(text(f"DELETE FROM factories WHERE id = '{fac_id}'"))

    db.commit()
    print("Cleanup complete!")
except Exception as e:
    print(f"Error: {e}")
    import traceback

    traceback.print_exc()
    db.rollback()
finally:
    db.close()
