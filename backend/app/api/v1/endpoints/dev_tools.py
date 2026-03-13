import random
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.models.production import ProductionRun

router = APIRouter()

class SetupAndSeedRequest(BaseModel):
    user_email: str

async def get_or_create_factory(db: AsyncSession, user_email: str):
    import uuid
    from app.models.factory import Factory
    from app.models.user import Organization, User
    
    result_user = await db.execute(select(User).where(User.email == user_email))
    user = result_user.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User with email {user_email} not found. Cannot proceed with mock ingestion.")
            
    valid_org_id = user.organization_id

    result = await db.execute(select(Factory).where(Factory.organization_id == valid_org_id))
    factory = result.scalars().first()
    if not factory:
        unique_suffix = uuid.uuid4().hex[:6]
        factory = Factory(
            organization_id=valid_org_id, 
            name=f"Demo Factory {unique_suffix}", 
            country="USA",
            code=f"F-DEMO-{unique_suffix}"
        )
        db.add(factory)
        await db.flush()
    return factory

@router.post("/setup-datasource-and-seed", status_code=status.HTTP_201_CREATED)
async def setup_datasource_and_seed(
    request: SetupAndSeedRequest,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Phase 1: True E2E Mock Ingestion.
    Provisions a Data Source, locks its Schema Mapping, and promotes 100 mock rows.
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=403, detail="Demo tools inactive in production.")

    import json
    import uuid
    import hashlib
    from app.models.datasource import DataSource, SchemaMapping
    from app.models.raw_import import RawImport, StagingRecord
    from app.services.file_processor import FileProcessingService

    # 1. Provisioning
    factory = await get_or_create_factory(db, request.user_email)
    
    unique_ds_suffix = uuid.uuid4().hex[:6]
    data_source = DataSource(
        factory_id=factory.id,
        name=f"Retrofit Edge Node {unique_ds_suffix}",
        time_column="T_STAMP_LOCAL"
    )
    db.add(data_source)
    await db.flush()

    # 2. Schema Locking - Prevent UI ValueError
    schema_mapping = SchemaMapping(
        data_source_id=data_source.id,
        version=1,
        is_active=True,
        column_map={
            "T_STAMP_LOCAL": "production_date",
            "PLC_SENSOR_GOOD_CTX": "actual_qty",
            "PLC_SENSOR_REJECT_CTX": "defects",
            "HMI_ACTIVE_RECIPE": "style_number",
            "MES_WORK_ORDER_REF": "batch_number",
            "SYS_SHIFT_ID": "shift",
            "EDGE_NODE_MAC": "line_id",
            "ALARM_DUR_MIN": "downtime_minutes",
            "ALARM_CODE_HEX": "downtime_reason"
        },
        reviewed_by_user=True
    )
    db.add(schema_mapping)
    await db.flush()

    # 3. Bypass Engine - Direct DB Insertion for Phase 1
    import uuid
    from decimal import Decimal
    from app.models.production import Style, Order, ProductionRun
    from app.models.analytics import EfficiencyMetric
    
    unique_ds_suffix = uuid.uuid4().hex[:6]
    
    # Create a dummy Style and Order to satisfy Foreign Keys
    style = Style(
        factory_id=factory.id,
        style_number=f"ST-MOCK-{unique_ds_suffix}",
        base_sam=Decimal('15.5')
    )
    db.add(style)
    await db.flush()

    order = Order(
        style_id=style.id,
        po_number=f"PO-MOCK-{unique_ds_suffix}",
        quantity=10000
    )
    db.add(order)
    await db.flush()
    
    base_time = datetime.utcnow() - timedelta(days=7)
    
    # 3 batches matching Sequential_2025-01 over 3 days
    batches = [
        {"db": 0, "shift": "A", "qty": 336, "rej": 9, "dur": 2, "workers": 18, "plan": 416},
        {"db": 1, "shift": "B", "qty": 370, "rej": 15, "dur": 1, "workers": 14, "plan": 365},
        {"db": 2, "shift": "A", "qty": 532, "rej": 9, "dur": 14, "workers": 24, "plan": 680}
    ]
    
    runs = []
    metrics = []

    for b_idx, b_stats in enumerate(batches):
        day_time = base_time + timedelta(days=b_stats["db"])
        
        # We will stagger the total qty across 24 hourly rows per batch
        qty_per_row = max(1, b_stats["qty"] // 24)
        rej_per_row = max(1, b_stats["rej"] // 24) if b_stats["rej"] > 0 else 0
        
        for i in range(24):
            run_time = day_time + timedelta(hours=i)
            # Create ProductionRun
            pr = ProductionRun(
                id=str(uuid.uuid4()),
                factory_id=factory.id,
                order_id=order.id,
                data_source_id=data_source.id,
                production_date=run_time,
                shift=b_stats["shift"],
                actual_qty=qty_per_row,
                defects=rej_per_row,
                batch_number=f"MOCK-B-{b_idx+1}-{i}",
                sam=Decimal('15.5'),
                operators_present=b_stats["workers"],
                worked_minutes=Decimal('60.0'),
                downtime_minutes=b_stats["dur"] if i == 10 else 0,
                downtime_reason="0xERR_TENS" if i == 10 and b_stats["dur"] > 0 else None
            )
            runs.append(pr)

    db.add_all(runs)
    await db.flush()  # DB handles the computed `efficiency` column, but we also manually add EfficiencyMetric

    for pr in runs:
        # Earned minutes = actual * SAM
        earned_mins = Decimal(pr.actual_qty) * pr.sam
        available_mins = pr.worked_minutes * pr.operators_present
        efficiency_pct = (earned_mins / available_mins) * 100 if available_mins > 0 else Decimal('0')
        
        em = EfficiencyMetric(
            id=str(uuid.uuid4()),
            production_run_id=pr.id,
            efficiency_pct=efficiency_pct,
            sam_target=pr.sam,
            sam_actual=pr.sam,
            calculated_at=datetime.utcnow()
        )
        metrics.append(em)

    db.add_all(metrics)
    await db.commit()

    return {
        "status": "success",
        "data_source_id": data_source.id,
        "promoted_count": len(runs),
        "message": f"Data Source provisioned, schema locked, and {len(runs)} mock rows generated natively."
    }

class TriggerIncrementalRequest(BaseModel):
    data_source_id: str
    count: int

async def stream_telemetry_events(data_source_id: str, count: int):
    import asyncio
    import redis
    import logging
    from datetime import datetime
    from app.schemas.telemetry import TelemetryEvent, BundleEventType
    
    logger = logging.getLogger(__name__)
    
    try:
        redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
        # Attempt to ping to fail fast if Redis is down
        redis_client.ping()
    except Exception as e:
        logger.error(f"Redis connection failed for stream_telemetry_events: {e}")
        return

    logger.info(f"Background task starting: streaming {count} events for source {data_source_id}")

    for i in range(count):
        event = TelemetryEvent(
            event_type=BundleEventType.PART_COUNTED,
            timestamp=datetime.utcnow(),
            device_id=data_source_id,
            part_count=i + 1
        )
        redis_client.lpush("retrofit_telemetry_queue", event.model_dump_json())
        await asyncio.sleep(0.5)

    final_event = TelemetryEvent(
        event_type=BundleEventType.BUNDLE_COMPLETED,
        timestamp=datetime.utcnow(),
        device_id=data_source_id,
        part_count=count
    )
    redis_client.lpush("retrofit_telemetry_queue", final_event.model_dump_json())
    logger.info("Background task finished streaming events.")

@router.post("/trigger-incremental-sensor", status_code=status.HTTP_200_OK)
async def trigger_incremental_sensor(
    request: TriggerIncrementalRequest,
    background_tasks: BackgroundTasks
):
    """
    Phase 2: Real-Time Incremental SCADA Stream
    Streams TelemetryEvents into Redis queue simulating Edge Node activity.
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=403, detail="Demo tools inactive in production.")

    background_tasks.add_task(
        stream_telemetry_events, 
        data_source_id=request.data_source_id, 
        count=request.count
    )

    return {
        "status": "success",
        "message": f"Started streaming {request.count} events in the background for {request.data_source_id}."
    }
