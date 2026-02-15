# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Test AI Decision Logging functionality.
Verifies schema inference and code generation decisions are logged correctly.
"""

import pytest
from sqlalchemy import select

from app.models.ai_decision import AgentType, AIDecision
from app.private_core.etl_agent import SemanticETLAgent


@pytest.fixture
def mock_llm_response(mocker):
    """Mock the LLM response for SemanticETLAgent."""
    mock_content = '{"detected_headers": ["Date", "Style", "Qty"], "header_row": 0, "column_mappings": {"Date": "production_date", "Style": "style_number", "Qty": "quantity"}, "confidence_scores": {"Date": 0.95, "Style": 0.90, "Qty": 0.85}, "data_types": {"Date": "date", "Style": "string", "Qty": "integer"}, "recommendations": ["Test recommendation"], "reasoning": {"target_table": "production_runs"}, "cleaning_code": "def clean(df): return df"}'

    mock_message = mocker.MagicMock()
    mock_message.content = mock_content

    mock_choice = mocker.MagicMock()
    mock_choice.message = mock_message

    mock_response = mocker.MagicMock()
    mock_response.choices = [mock_choice]
    mock_response.usage.total_tokens = 100

    # We need to patch the chat completion create method on the CLIENT instance
    # Since _init_client is mocked in conftest to return a MagicMock, we need to access THAT mock.
    # But here we interact with the agent instance.

    # Strategy: Patch SemanticETLAgent._init_client to return our configured mock client
    mock_client = mocker.MagicMock()
    mock_client.chat.completions.create.return_value = mock_response

    mocker.patch(
        "app.private_core.etl_agent.SemanticETLAgent._init_client", return_value=mock_client
    )

    return mock_client


@pytest.mark.asyncio
async def test_ai_decision_creation(db_session):
    """Test that AIDecision records can be created."""
    decision = AIDecision(
        agent_type=AgentType.SCHEMA_INFERENCE,
        model_used="deepseek-v3",
        input_summary="Test input",
        output_summary="Test output",
        confidence=0.95,
        reasoning={"test": "data"},
        performance_metadata={"tokens_used": 100, "latency_ms": 500},
    )

    db_session.add(decision)
    await db_session.commit()
    await db_session.refresh(decision)

    assert decision.id is not None
    assert decision.created_at is not None
    assert decision.agent_type == AgentType.SCHEMA_INFERENCE
    assert decision.confidence == 0.95


@pytest.mark.asyncio
async def test_schema_inference_logging(db_session, mock_llm_response, test_line):
    """Test that schema inference logs decisions to database."""
    from app.models.datasource import DataSource

    # Create valid data source
    ds = DataSource(
        production_line_id=test_line.id, source_name="Test", description="Desc"
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    # Create agent with DB session
    agent = SemanticETLAgent(db_session=db_session)

    # Sample Excel data
    sample_rows = [
        ["Date", "Style", "Qty", "Color"],
        ["12/25/2024", "ABC-123", "500", "Navy"],
        ["12/26/2024", "XYZ-789", "300", "Black"],
    ]

    # Run schema inference (this should log a decision)
    await agent.infer_schema(
        sample_rows=sample_rows,
        filename="test_production.xlsx",
        file_type_hint="production_data",
        data_source_id=ds.id,
    )

    await db_session.commit()

    # Verify decision was logged
    result = await db_session.execute(
        select(AIDecision).where(
            AIDecision.agent_type == AgentType.SCHEMA_INFERENCE,
            AIDecision.data_source_id == ds.id,
        )
    )
    decision = result.scalar_one_or_none()

    assert decision is not None, "AI decision should be logged"
    assert decision.model_used in [
        "deepseek-v3",
        "gpt-4o",
        "deepseek-chat",
    ]  # Adjusted for defaults
    assert decision.confidence is not None
    assert decision.confidence > 0
    assert "column_mappings" in decision.reasoning
    assert "tokens_used" in decision.performance_metadata
    assert "latency_ms" in decision.performance_metadata
    assert decision.input_summary.startswith("File: test_production.xlsx")


@pytest.mark.asyncio
async def test_code_generation_logging(db_session, mock_llm_response, test_line):
    """Test that code generation logs decisions to database."""
    from app.models.datasource import DataSource
    from app.private_core.etl_agent import SchemaInference

    # Create valid data source
    ds = DataSource(
        production_line_id=test_line.id, source_name="Test2", description="Desc2"
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    # Create agent with DB session
    agent = SemanticETLAgent(db_session=db_session)

    # Mock schema
    schema = SchemaInference(
        detected_headers=["Date", "Style", "Qty"],
        header_row=0,
        column_mappings={
            "Date": "production_date",
            "Style": "style_number",
            "Qty": "quantity",
        },
        data_types={"Date": "date", "Style": "string", "Qty": "integer"},
        confidence_scores={"Date": 0.95, "Style": 0.90, "Qty": 0.85},
        recommendations=["Test recommendation"],
    )

    sample_data = [
        ["Date", "Style", "Qty"],
        ["12/25/2024", "ABC-123", "500"],
    ]

    # Generate cleaning code (this should log a decision)
    await agent.generate_cleaning_code(
        schema=schema,
        target_table="production_runs",
        sample_data=sample_data,
        data_source_id=ds.id,
    )

    await db_session.commit()

    # Verify decision was logged
    result = await db_session.execute(
        select(AIDecision).where(
            AIDecision.agent_type == AgentType.CODE_GENERATION,
            AIDecision.data_source_id == ds.id,
        )
    )
    decision = result.scalar_one_or_none()

    assert decision is not None, "AI decision should be logged"
    assert decision.model_used in ["deepseek-v3", "gpt-4o", "deepseek-chat"]
    assert decision.confidence == 0.85
    assert "target_table" in decision.reasoning
    assert decision.reasoning["target_table"] == "production_runs"
    assert "code_length" in decision.performance_metadata
    assert decision.input_summary.startswith("Target: production_runs")


@pytest.mark.asyncio
async def test_ai_decision_without_db_session(mock_llm_response):
    """Test that agent works without DB session (logging is optional)."""
    # Create agent without DB session
    agent = SemanticETLAgent(db_session=None)

    sample_rows = [
        ["Date", "Style", "Qty"],
        ["12/25/2024", "ABC-123", "500"],
    ]

    # Should not raise error even without DB session
    schema = await agent.infer_schema(
        sample_rows=sample_rows,
        filename="test.xlsx",
    )

    assert schema is not None
    assert len(schema.detected_headers) > 0


@pytest.mark.asyncio
async def test_ai_decision_data_source_relationship(
    db_session, test_organization, test_factory, test_line, mock_llm_response
):
    """Test that AI decisions link to data sources correctly."""
    from app.models.datasource import DataSource

    # Create a data source
    data_source = DataSource(
        production_line_id=test_line.id,
        source_name="Test Source",
        description="Test data source",
    )
    db_session.add(data_source)
    await db_session.commit()
    await db_session.refresh(data_source)

    # Create agent and log decision
    agent = SemanticETLAgent(db_session=db_session)

    sample_rows = [["Date", "Qty"], ["12/25/2024", "500"]]

    await agent.infer_schema(
        sample_rows=sample_rows,
        filename="test.xlsx",
        data_source_id=data_source.id,
    )

    await db_session.commit()
    await db_session.refresh(data_source)

    # Verify relationship
    assert len(data_source.ai_decisions) > 0
    assert data_source.ai_decisions[0].agent_type == AgentType.SCHEMA_INFERENCE


@pytest.mark.asyncio
async def test_ai_decision_confidence_calculation(
    db_session, mock_llm_response, test_line
):
    """Test that confidence scores are calculated correctly."""
    from app.models.datasource import DataSource

    # Create valid data source
    ds = DataSource(
        production_line_id=test_line.id, source_name="Test3", description="Desc3"
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    agent = SemanticETLAgent(db_session=db_session)

    sample_rows = [
        ["Date", "Style#", "Quantity", "Color"],
        ["12/25/2024", "ABC-123", "500", "Navy"],
    ]

    schema = await agent.infer_schema(
        sample_rows=sample_rows,
        filename="test.xlsx",
        data_source_id=ds.id,
    )

    await db_session.commit()

    # Get logged decision
    result = await db_session.execute(
        select(AIDecision).where(AIDecision.data_source_id == ds.id)
    )
    decision = result.scalar_one()

    # Confidence should be average of all column confidence scores
    if schema.confidence_scores:
        expected_confidence = sum(schema.confidence_scores.values()) / len(
            schema.confidence_scores
        )
        assert abs(decision.confidence - expected_confidence) < 0.01


@pytest.mark.asyncio
async def test_ai_decision_metadata_completeness(
    db_session, mock_llm_response, test_line
):
    """Test that all metadata fields are populated."""
    from app.models.datasource import DataSource

    # Create valid data source
    ds = DataSource(
        production_line_id=test_line.id, source_name="Test4", description="Desc4"
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    agent = SemanticETLAgent(db_session=db_session)

    sample_rows = [["Date", "Qty"], ["12/25/2024", "500"]]

    await agent.infer_schema(
        sample_rows=sample_rows,
        filename="test.xlsx",
        data_source_id=ds.id,
    )

    await db_session.commit()

    result = await db_session.execute(
        select(AIDecision).where(AIDecision.data_source_id == ds.id)
    )
    decision = result.scalar_one()

    # Verify all metadata fields
    assert "latency_ms" in decision.performance_metadata
    assert "temperature" in decision.performance_metadata
    assert "model" in decision.performance_metadata
    assert decision.performance_metadata["latency_ms"] >= 0
    assert decision.performance_metadata["temperature"] == 0.1
    assert decision.performance_metadata["model"] in ["deepseek-chat", "gpt-4o"]
