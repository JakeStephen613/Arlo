from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Concept(BaseModel):
    id: UUID
    name: str
    topic: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime


class ConceptPrerequisite(BaseModel):
    concept_id: UUID
    prerequisite_id: UUID


class LearnerConceptState(BaseModel):
    id: UUID
    user_id: UUID
    concept_id: UUID
    mastery: float = 0.0
    uncertainty: float = 1.0
    attempt_count: int = 0
    correct_count: int = 0
    last_seen: Optional[datetime] = None
    next_review: Optional[datetime] = None
    streak: int = 0
    created_at: datetime
    updated_at: datetime


class Attempt(BaseModel):
    id: UUID
    user_id: UUID
    concept_id: UUID
    session_id: Optional[UUID] = None
    mode: str
    score: float = Field(ge=0.0, le=1.0)
    latency_ms: Optional[int] = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime


class Session(BaseModel):
    id: UUID
    user_id: UUID
    intent: Optional[str] = None
    plan: dict = Field(default_factory=dict)
    outcomes: dict = Field(default_factory=dict)
    started_at: datetime
    ended_at: Optional[datetime] = None
