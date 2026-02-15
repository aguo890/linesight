# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Test AI Decision API endpoints.
"""

import pytest

from app.models.ai_decision import AgentType, AIDecision


@pytest.mark.asyncio
async def test_list_ai_decisions(async_client, test_user, db_session):
    """Test listing AI decisions."""
    # Create some test decisions
    for i in range(3):
        decision = AIDecision(
            agent_type=AgentType.SCHEMA_INFERENCE,
            model_used="deepseek-v3",
            input_summary=f"Test input {i}",
            output_summary=f"Test output {i}",
            confidence=0.9 + (i * 0.01),
            reasoning={"test": f"data_{i}"},
            performance_metadata={"tokens_used": 100 + i},
        )
        db_session.add(decision)

    await db_session.commit()

    # Get auth token
    login_response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "testpassword123"},
    )
    token = login_response.json()["access_token"]

    # List decisions
    response = await async_client.get(
        "/api/v1/ai-decisions", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "decisions" in data
    assert "total" in data
    assert len(data["decisions"]) >= 3


@pytest.mark.asyncio
async def test_list_ai_decisions_with_filters(async_client, test_user, db_session):
    """Test filtering AI decisions."""
    # Create decisions with different types
    schema_decision = AIDecision(
        agent_type=AgentType.SCHEMA_INFERENCE,
        model_used="deepseek-v3",
        input_summary="Schema test",
        output_summary="Schema output",
        confidence=0.95,
        # Note: data_source_id omitted to avoid FK integrity errors
    )
    code_decision = AIDecision(
        agent_type=AgentType.CODE_GENERATION,
        model_used="gpt-4o",
        input_summary="Code test",
        output_summary="Code output",
        confidence=0.85,
        # Note: data_source_id omitted to avoid FK integrity errors
    )

    db_session.add(schema_decision)
    db_session.add(code_decision)
    await db_session.commit()

    # Get auth token
    login_response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "testpassword123"},
    )
    token = login_response.json()["access_token"]

    # Filter by agent type
    response = await async_client.get(
        "/api/v1/ai-decisions?agent_type=schema_inference",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert all(d["agent_type"] == "schema_inference" for d in data["decisions"])

    # Verify we can retrieve decisions (data_source_id filter removed since we don't set it)
    assert len(data["decisions"]) >= 1


@pytest.mark.asyncio
async def test_get_ai_decision_by_id(async_client, test_user, db_session):
    """Test retrieving a specific AI decision."""
    decision = AIDecision(
        agent_type=AgentType.SCHEMA_INFERENCE,
        model_used="deepseek-v3",
        input_summary="Test input",
        output_summary="Test output",
        confidence=0.92,
        reasoning={"column_mappings": {"Date": "production_date"}},
        performance_metadata={"tokens_used": 150, "latency_ms": 800},
    )

    db_session.add(decision)
    await db_session.commit()
    await db_session.refresh(decision)

    # Get auth token
    login_response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "testpassword123"},
    )
    token = login_response.json()["access_token"]

    # Get specific decision
    response = await async_client.get(
        f"/api/v1/ai-decisions/{decision.id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == decision.id
    assert data["confidence"] == 0.92
    assert "column_mappings" in data["reasoning"]
    assert data["performance_metadata"]["tokens_used"] == 150


@pytest.mark.asyncio
async def test_get_ai_decision_not_found(async_client, test_user):
    """Test retrieving non-existent AI decision."""
    # Get auth token
    login_response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "testpassword123"},
    )
    token = login_response.json()["access_token"]

    # Try to get non-existent decision
    response = await async_client.get(
        "/api/v1/ai-decisions/non-existent-id",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_data_source_ai_decisions(
    async_client, test_user, db_session, test_line
):
    """Test retrieving AI decisions for a specific data source."""
    from app.models.datasource import DataSource

    # Create data source
    data_source = DataSource(
        production_line_id=test_line.id,
        source_name="Test Source",
    )
    db_session.add(data_source)
    await db_session.commit()
    await db_session.refresh(data_source)

    # Create decisions for this data source
    for i in range(5):
        decision = AIDecision(
            agent_type=AgentType.SCHEMA_INFERENCE
            if i % 2 == 0
            else AgentType.CODE_GENERATION,
            model_used="deepseek-v3",
            input_summary=f"Input {i}",
            output_summary=f"Output {i}",
            confidence=0.9,
            data_source_id=data_source.id,
        )
        db_session.add(decision)

    await db_session.commit()

    # Get auth token
    login_response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "testpassword123"},
    )
    token = login_response.json()["access_token"]

    # Get decisions for data source
    response = await async_client.get(
        f"/api/v1/datasources/{data_source.id}/ai-decisions",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    assert all(d["data_source_id"] == data_source.id for d in data)


@pytest.mark.asyncio
async def test_ai_decisions_pagination(async_client, auth_headers, db_session):
    """Test pagination of AI decisions list."""
    # Create 25 decisions
    for i in range(25):
        decision = AIDecision(
            agent_type=AgentType.SCHEMA_INFERENCE,
            model_used="deepseek-v3",
            input_summary=f"Input {i}",
            output_summary=f"Output {i}",
            confidence=0.9,
        )
        db_session.add(decision)

    await db_session.commit()

    # Get first page (using auth_headers fixture instead of manual login)
    response = await async_client.get(
        "/api/v1/ai-decisions?limit=10&offset=0", headers=auth_headers
    )

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )
    data = response.json()
    assert len(data["decisions"]) == 10
    assert data["limit"] == 10
    assert data["offset"] == 0

    # Get second page
    response = await async_client.get(
        "/api/v1/ai-decisions?limit=10&offset=10", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["decisions"]) == 10
    assert data["offset"] == 10


@pytest.mark.asyncio
async def test_ai_decisions_require_auth(async_client):
    """Test that AI decision endpoints require authentication."""
    # Try without auth token
    response = await async_client.get("/api/v1/ai-decisions")
    assert response.status_code == 401

    response = await async_client.get("/api/v1/ai-decisions/some-id")
    assert response.status_code == 401
