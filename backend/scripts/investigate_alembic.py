# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import os
import sys

from sqlalchemy import create_engine, text

# Add the parent directory to sys.path to allow importing from 'app'
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)  # noqa: E402

from app.core.config import settings  # noqa: E402


def check_alembic_version():
    print(f"Connecting to: {settings.database_url}")
    engine = create_engine(settings.database_url)

    with engine.connect() as conn:
        print("\n--- Checking Tables ---")
        result = conn.execute(text("SHOW TABLES"))
        tables = [row[0] for row in result]
        print(f"Tables found: {tables}")

        if 'alembic_version' in tables:
            print("\n--- Checking alembic_version content ---")
            result = conn.execute(text("SELECT * FROM alembic_version"))
            versions = [row[0] for row in result]
            print(f"Versions found: {versions}")
            if not versions:
                print("❌ RED FLAG: alembic_version table exists but is EMPTY!")
        else:
             print("❌ RED FLAG: alembic_version table DOES NOT EXIST!")

if __name__ == "__main__":
    check_alembic_version()
