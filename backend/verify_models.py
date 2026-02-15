# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

# verify_models.py
"""
Phase 2 Verification Script: Database-Model Handshake Test
"""

import logging
import sys

# Required for imports to work when running from this directory
sys.path.insert(0, ".")

from sqlalchemy import text

from app.core.database import SyncSessionLocal
from app.models.datasource import DataSource
from app.models.events import ProductionEvent
from app.models.factory import Factory
from app.models.production import ProductionRun
from app.models.user import UserScope
from app.models.workforce import Worker

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def verify_phase_2():
    db = SyncSessionLocal()
    all_passed = True

    try:
        logger.info("=" * 60)
        logger.info("PHASE 2 VERIFICATION: Database-Model Handshake Test")
        logger.info("=" * 60)

        # =====================================================================
        # TEST 1: Raw SQL Connection
        # =====================================================================
        logger.info("\n--- TEST 1: Raw SQL Connection ---")
        try:
            result = db.execute(text("SELECT count(*) FROM data_sources"))
            count = result.scalar()
            logger.info(f"✅ 'data_sources' table exists. Row count: {count}")
        except Exception as e:
            logger.error(f"❌ SQL query failed: {e}")
            all_passed = False

        # Verify new columns exist
        logger.info("\n--- TEST 1b: Verify New Columns Exist ---")
        try:
            result = db.execute(text("""
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'data_sources'
                AND COLUMN_NAME IN ('factory_id', 'name', 'parent_data_source_id', 'is_segment', 'date_range_start')
            """))
            columns = [row[0] for row in result.fetchall()]
            expected = ['factory_id', 'name', 'parent_data_source_id', 'is_segment', 'date_range_start']
            for col in expected:
                if col in columns:
                    logger.info(f"  ✅ Column '{col}' exists")
                else:
                    logger.error(f"  ❌ Column '{col}' MISSING!")
                    all_passed = False
        except Exception as e:
            logger.error(f"❌ Column check failed: {e}")
            all_passed = False

        # =====================================================================
        # TEST 2: SQLAlchemy Model Mapping
        # =====================================================================
        logger.info("\n--- TEST 2: SQLAlchemy Model Mapping ---")
        try:
            ds = db.query(DataSource).first()

            if not ds:
                logger.warning("⚠️ No DataSources found (DB is empty). Checking model attributes...")
                # Verify model has expected attributes
                model_attrs = ['id', 'factory_id', 'name', 'is_segment', 'parent_data_source_id', 'date_range_start']
                for attr in model_attrs:
                    if hasattr(DataSource, attr):
                        logger.info(f"  ✅ DataSource.{attr} attribute exists")
                    else:
                        logger.error(f"  ❌ DataSource.{attr} attribute MISSING!")
                        all_passed = False
            else:
                logger.info(f"✅ Fetched DataSource via ORM: {ds.name}")
                # Verify new fields are accessible
                logger.info(f"   - ID: {ds.id}")
                logger.info(f"   - Factory ID: {ds.factory_id}")
                logger.info(f"   - Name: {ds.name}")
                logger.info(f"   - Is Segment: {ds.is_segment}")
                logger.info(f"   - Parent ID: {ds.parent_data_source_id}")
                logger.info(f"   - Date Range Start: {ds.date_range_start}")

        except Exception as e:
            logger.error(f"❌ Model mapping failed: {e}")
            all_passed = False

        # =====================================================================
        # TEST 3: Relationships
        # =====================================================================
        logger.info("\n--- TEST 3: Relationships ---")

        # Factory -> DataSource relationship
        try:
            factory = db.query(Factory).first()
            if factory:
                try:
                    sources = factory.data_sources
                    logger.info(f"✅ Factory '{factory.name}' -> data_sources relationship: {len(sources)} items")
                except AttributeError as e:
                    logger.error(f"❌ Factory.data_sources relationship MISSING! {e}")
                    all_passed = False
            else:
                logger.warning("⚠️ No factories found to test relationship")
        except Exception as e:
            logger.error(f"❌ Factory relationship test failed: {e}")
            all_passed = False

        # DataSource self-referential hierarchy
        try:
            if hasattr(DataSource, 'parent') and hasattr(DataSource, 'segments'):
                logger.info("✅ DataSource.parent and DataSource.segments relationships exist")
            else:
                logger.error("❌ Hierarchy relationships MISSING!")
                all_passed = False
        except Exception as e:
            logger.error(f"❌ Hierarchy test failed: {e}")
            all_passed = False

        # =====================================================================
        # TEST 4: Renamed FK Columns
        # =====================================================================
        logger.info("\n--- TEST 4: Renamed FK Columns ---")

        # UserScope.data_source_id
        try:
            if hasattr(UserScope, 'data_source_id'):
                logger.info("✅ UserScope.data_source_id exists")
            else:
                logger.error("❌ UserScope.data_source_id MISSING!")
                all_passed = False
        except Exception as e:
            logger.error(f"❌ UserScope check failed: {e}")
            all_passed = False

        # ProductionRun.data_source_id
        try:
            if hasattr(ProductionRun, 'data_source_id'):
                logger.info("✅ ProductionRun.data_source_id exists")
            else:
                logger.error("❌ ProductionRun.data_source_id MISSING!")
                all_passed = False
        except Exception as e:
            logger.error(f"❌ ProductionRun check failed: {e}")
            all_passed = False

        # Worker.data_source_id
        try:
            if hasattr(Worker, 'data_source_id'):
                logger.info("✅ Worker.data_source_id exists")
            else:
                logger.error("❌ Worker.data_source_id MISSING!")
                all_passed = False
        except Exception as e:
            logger.error(f"❌ Worker check failed: {e}")
            all_passed = False

        # ProductionEvent.data_source_id
        try:
            if hasattr(ProductionEvent, 'data_source_id'):
                logger.info("✅ ProductionEvent.data_source_id exists")
            else:
                logger.error("❌ ProductionEvent.data_source_id MISSING!")
                all_passed = False
        except Exception as e:
            logger.error(f"❌ ProductionEvent check failed: {e}")
            all_passed = False

        # =====================================================================
        # SUMMARY
        # =====================================================================
        logger.info("\n" + "=" * 60)
        if all_passed:
            logger.info("✅ ALL TESTS PASSED - Phase 2 Foundation is SOLID")
        else:
            logger.error("❌ SOME TESTS FAILED - Review errors above")
        logger.info("=" * 60)

        return all_passed

    except Exception as e:
        logger.error(f"❌ VERIFICATION FAILED: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    success = verify_phase_2()
    sys.exit(0 if success else 1)
