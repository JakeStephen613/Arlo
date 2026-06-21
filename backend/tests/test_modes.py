"""Tests for mode refactoring — each mode grades and records attempts.

Tests the grade→record_attempt path without network calls by mocking
the Supabase layer and LLM calls.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

# We need to mock config before importing anything that uses it
import sys
import types

# Pre-populate config so imports don't crash
_mock_config = types.ModuleType("app.core.config")
_mock_config.ANTHROPIC_API_KEY = "test-key"
_mock_config.SUPABASE_URL = "https://test.supabase.co"
_mock_config.SUPABASE_SERVICE_ROLE = "test-role"
_mock_config.SUPABASE_JWT_SECRET = "test-secret"
_mock_config.ENV = "test"
_mock_config.CONTEXT_API_BASE = "http://localhost:10000"
_mock_config.ALLOWED_ORIGINS = ["http://localhost:5173"]
sys.modules["app.core.config"] = _mock_config

from app.services.mastery import MasteryState, MasteryUpdate, update_mastery
from app.services.learner_context import AttemptRecord, record_attempt


@pytest.fixture
def mock_supabase():
    """Mock Supabase client for all database operations."""
    mock_client = MagicMock()

    # Mock select chain for learner_concept_state
    mock_select = MagicMock()
    mock_select.execute.return_value = MagicMock(data=[])
    mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value = mock_select

    # Mock insert
    mock_insert = MagicMock()
    mock_insert.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])
    mock_client.table.return_value.insert.return_value = mock_insert

    # Mock upsert
    mock_upsert = MagicMock()
    mock_upsert.execute.return_value = MagicMock(data=[])
    mock_client.table.return_value.upsert.return_value = mock_upsert

    with patch("app.services.learner_context._get_supabase", return_value=mock_client):
        yield mock_client


class TestRecordAttempt:
    def test_correct_answer_creates_attempt_and_updates_state(self, mock_supabase):
        user_id = uuid4()
        concept_id = uuid4()

        record = AttemptRecord(
            user_id=user_id,
            concept_id=concept_id,
            mode="quiz",
            score=1.0,
        )

        result = record_attempt(record)

        assert isinstance(result, MasteryUpdate)
        assert result.mastery > 0.0
        assert result.next_review is not None

        # Verify insert was called for attempts table
        mock_supabase.table.assert_any_call("attempts")

    def test_wrong_answer_lowers_mastery(self, mock_supabase):
        user_id = uuid4()
        concept_id = uuid4()

        record = AttemptRecord(
            user_id=user_id,
            concept_id=concept_id,
            mode="quiz",
            score=0.0,
        )

        result = record_attempt(record)
        assert isinstance(result, MasteryUpdate)
        assert result.mastery < 0.5

    def test_feynman_mode_records(self, mock_supabase):
        record = AttemptRecord(
            user_id=uuid4(),
            concept_id=uuid4(),
            mode="feynman",
            score=0.85,
            metadata={"mastery_score": 85},
        )
        result = record_attempt(record)
        assert result.mastery > 0

    def test_blurting_mode_records(self, mock_supabase):
        record = AttemptRecord(
            user_id=uuid4(),
            concept_id=uuid4(),
            mode="blurting",
            score=0.6,
        )
        result = record_attempt(record)
        assert result.mastery > 0

    def test_flashcard_mode_records(self, mock_supabase):
        record = AttemptRecord(
            user_id=uuid4(),
            concept_id=uuid4(),
            mode="flashcard",
            score=1.0,
        )
        result = record_attempt(record)
        assert result.mastery > 0

    def test_teach_check_mode_records(self, mock_supabase):
        record = AttemptRecord(
            user_id=uuid4(),
            concept_id=uuid4(),
            mode="teach_check",
            score=0.7,
        )
        result = record_attempt(record)
        assert result.mastery > 0


class TestMasteryUpdate:
    def test_correct_raises_mastery(self):
        state = MasteryState(mastery=0.3, attempt_count=5, correct_count=2, streak=0)
        result = update_mastery(state, score=1.0)
        assert result.mastery > 0.3

    def test_wrong_lowers_mastery(self):
        state = MasteryState(mastery=0.7, attempt_count=5, correct_count=4, streak=3)
        result = update_mastery(state, score=0.0)
        assert result.mastery < 0.7

    def test_intervals_expand_with_streaks(self):
        state = MasteryState(mastery=0.5, streak=0)
        r1 = update_mastery(state, score=1.0)

        state2 = MasteryState(mastery=r1.mastery, streak=r1.streak)
        r2 = update_mastery(state2, score=1.0)

        assert r2.next_review > r1.next_review

    def test_mastery_stays_bounded(self):
        state = MasteryState(mastery=0.99, streak=50, attempt_count=100, correct_count=100)
        result = update_mastery(state, score=1.0)
        assert 0.0 <= result.mastery <= 1.0


class TestStreamingLLM:
    def test_call_messages_builds_kwargs(self):
        from app.services.llm import _build_kwargs

        messages = [
            {"role": "system", "content": "You are helpful."},
            {"role": "user", "content": "Hello"},
        ]
        kwargs = _build_kwargs(messages)
        assert kwargs["system"] == "You are helpful."
        assert len(kwargs["messages"]) == 1
        assert kwargs["messages"][0]["role"] == "user"

    def test_json_schema_format(self):
        from app.services.llm import _build_kwargs

        messages = [{"role": "user", "content": "test"}]
        kwargs = _build_kwargs(
            messages,
            response_format={
                "type": "json_schema",
                "json_schema": {"schema": {"type": "object"}},
            },
        )
        assert "output_config" in kwargs

    def test_json_object_format(self):
        from app.services.llm import _build_kwargs

        messages = [{"role": "user", "content": "test"}]
        kwargs = _build_kwargs(
            messages,
            response_format={"type": "json_object"},
        )
        assert "JSON" in kwargs.get("system", "")
