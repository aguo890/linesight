# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import os
import sys

# Add the parent directory to sys.path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.core.database import SyncSessionLocal
from app.core.security import hash_password
from app.models.user import Organization, User, UserRole


def seed():
    print("Connecting to database...")
    with SyncSessionLocal() as db:
        try:
            # Check if org exists
            res = db.execute(select(Organization).where(Organization.code == "DEMO"))
            org = res.scalar_one_or_none()

            if not org:
                print("Creating Demo Organization...")
                org = Organization(
                    name="Demo Org", code="DEMO", primary_email="demo@linesight.io"
                )
                db.add(org)
            else:
                print("Demo Organization already exists.")

            # Check if user exists
            print("Checking if user exists...")
            res = db.execute(select(User).where(User.email == "demo@linesight.io"))
            user = res.scalar_one_or_none()

            if not user:
                print("Creating Demo User...")
                user = User(
                    organization=org,
                    email="demo@linesight.io",
                    hashed_password=hash_password("demo1234"),
                    full_name="Demo User",
                    role=UserRole.ADMIN,
                    is_active=True,
                    is_verified=True,
                )
                db.add(user)
            else:
                print("Updating Demo User password to 'demo1234'...")
                user.organization = org
                user.hashed_password = hash_password("demo1234")

            print("Committing changes...")
            db.commit()
            print("Demo data seeded successfully.")
        except Exception as e:
            print(f"Error seeding data: {e}")
            db.rollback()


if __name__ == "__main__":
    seed()
