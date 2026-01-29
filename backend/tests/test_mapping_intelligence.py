
import pytest

from app.schemas.ingestion import ColumnMappingResult
from app.services.matching.engine import HybridMatchingEngine


@pytest.mark.asyncio
async def test_mapping_engine_intelligence(db_session, test_factory):
    """
    Verifies that the Matching Engine correctly identifies columns
    using Hash, Fuzzy, and Alias logic.
    """

    # 1. ARRANGE: Define 'Tricky' Headers commonly found in Excel
    # "Prod Date" -> Fuzzy match for 'production_date'
    # "Qty"       -> Alias/Fuzzy for 'actual_qty'
    # "Style#"    -> Fuzzy for 'style_number'
    # "Efficiency" -> Exact match (if field exists) or Fuzzy
    headers = ["Prod Date", "Qty", "Style#", "UnknownColumn123"]

    # Sample data helps the engine type-check (e.g. identify Dates)
    sample_data = {
        "Prod Date": ["2024-01-01", "2024-01-02"],
        "Qty": [100, 200],
        "Style#": ["ST-001", "ST-002"],
        "UnknownColumn123": ["??", "??"]
    }

    # 2. ACT: Run the Engine
    engine = HybridMatchingEngine(
        db_session=db_session,
        factory_id=test_factory.id,
        llm_enabled=False # Test core logic first, deterministic
    )
    await engine.initialize()

    results: list[ColumnMappingResult] = engine.match_columns(headers, sample_data)

    # Helper to find result by header name
    def get_mapping(header):
        return next((r for r in results if r.source_column == header), None)

    # 3. ASSERT: Verify the AI's guesses

    # Check Date Match
    date_map = get_mapping("Prod Date")
    assert date_map is not None
    assert date_map.target_field == "production_date"
    assert date_map.confidence > 0.8
    print(f"[OK] 'Prod Date' mapped to 'production_date' ({date_map.tier})")

    # Check Qty Match (Likely Fuzzy or Alias)
    qty_map = get_mapping("Qty")
    assert qty_map is not None
    assert qty_map.target_field == "actual_qty"
    print(f"[OK] 'Qty' mapped to 'actual_qty' ({qty_map.tier})")

    # Check Style Match
    style_map = get_mapping("Style#")
    assert style_map is not None
    assert style_map.target_field == "style_number"
    print(f"[OK] 'Style#' mapped to 'style_number' ({style_map.tier})")

    # Check Negative Match (Should be ignored or low confidence)
    unknown_map = get_mapping("UnknownColumn123")
    # Should either be None (ignored) or very low confidence/needs review
    if unknown_map.target_field:
        assert unknown_map.status == "needs_review"
        print("[OK] 'UnknownColumn123' correctly flagged for review")
    else:
        print("[OK] 'UnknownColumn123' correctly ignored")
