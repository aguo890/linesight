# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Data ingestion logic for Excel records.
Handles mapping and saving records to the database gracefully.
"""

from typing import Any

from sqlalchemy import select

from app.models.base import Base


class GracefulDataIngester:
    """
    Ingests parsed data into database models gracefully.

    Key principle: Create records with whatever data is available.
    Missing fields are left as NULL (if allowed) or filled with defaults.
    """

    def __init__(self, db_session):
        self.db = db_session
        self.created_count = 0
        self.updated_count = 0
        self.skipped_count = 0
        self.errors: list[str] = []

    async def ingest_records(
        self,
        records: list[dict[str, Any]],
        model_class: type[Base],
        unique_fields: list[str] | None = None,
        factory_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Ingest records into the database.

        Args:
            records: List of record dictionaries
            model_class: SQLAlchemy model to create
            unique_fields: Fields to check for existing records (upsert)
            factory_id: Factory ID to associate records with

        Returns:
            Summary of ingestion results
        """
        self.created_count = 0
        self.updated_count = 0
        self.skipped_count = 0
        self.errors = []

        for record in records:
            try:
                # Add factory_id if needed
                if factory_id and "factory_id" in [
                    c.name for c in model_class.__table__.columns
                ]:
                    record["factory_id"] = factory_id

                # Filter to only valid model fields
                valid_fields = {c.name for c in model_class.__table__.columns}
                filtered_record = {k: v for k, v in record.items() if k in valid_fields}

                # Check for existing record
                existing = None
                if unique_fields:
                    unique_values = {
                        f: filtered_record.get(f)
                        for f in unique_fields
                        if f in filtered_record
                    }
                    if all(v is not None for v in unique_values.values()):
                        query = select(model_class)
                        for field, value in unique_values.items():
                            query = query.where(getattr(model_class, field) == value)
                        result = await self.db.execute(query)
                        existing = result.scalar_one_or_none()

                if existing:
                    # Update existing record with new data
                    for key, value in filtered_record.items():
                        if value is not None:
                            setattr(existing, key, value)
                    self.updated_count += 1
                else:
                    # Create new record
                    new_record = model_class(**filtered_record)
                    self.db.add(new_record)
                    self.created_count += 1

            except Exception as e:
                self.errors.append(f"Error ingesting record: {str(e)}")
                self.skipped_count += 1

        # Commit all changes
        if self.created_count > 0 or self.updated_count > 0:
            try:
                await self.db.commit()
            except Exception as e:
                await self.db.rollback()
                self.errors.append(f"Failed to commit: {str(e)}")

        return {
            "created": self.created_count,
            "updated": self.updated_count,
            "skipped": self.skipped_count,
            "errors": self.errors,
        }
