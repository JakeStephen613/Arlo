"""Anthropic (Claude) LLM client.

Provides a small OpenAI-shaped adapter (`client.chat.completions.create(...)`)
so feature modules can call Claude without each one re-implementing the
request/response plumbing. The model is hardcoded to the latest Claude Haiku.
"""
from __future__ import annotations

from typing import Any

from anthropic import Anthropic

from app.core.config import ANTHROPIC_API_KEY

# Hardcoded for now — newest Claude Haiku model.
MODEL = "claude-haiku-4-5"
DEFAULT_MAX_TOKENS = 8192

_client = Anthropic(api_key=ANTHROPIC_API_KEY)


class _Message:
    def __init__(self, content: str) -> None:
        self.content = content


class _Choice:
    def __init__(self, content: str) -> None:
        self.message = _Message(content)


class _Response:
    """Mimics the subset of the OpenAI response shape used in this codebase."""

    def __init__(self, content: str) -> None:
        self.choices = [_Choice(content)]


class _Completions:
    def create(
        self,
        *,
        messages: list[dict[str, str]],
        response_format: dict[str, Any] | None = None,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float | None = None,
        model: str | None = None,  # accepted and ignored; model is hardcoded
        **_ignored: Any,
    ) -> _Response:
        # Anthropic takes the system prompt as a top-level arg, not a message.
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        system = "\n\n".join(system_parts)
        convo = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m["role"] != "system"
        ]

        kwargs: dict[str, Any] = {
            "model": MODEL,
            "max_tokens": max_tokens,
            "messages": convo,
        }
        if system:
            kwargs["system"] = system
        if temperature is not None:
            kwargs["temperature"] = temperature

        # Translate OpenAI response_format → Anthropic structured outputs.
        if response_format:
            fmt_type = response_format.get("type")
            if fmt_type == "json_schema":
                schema = response_format["json_schema"]["schema"]
                kwargs["output_config"] = {
                    "format": {"type": "json_schema", "schema": schema}
                }
            elif fmt_type == "json_object":
                kwargs["system"] = (
                    (system + "\n\n") if system else ""
                ) + "Respond with a single valid JSON object and nothing else."

        resp = _client.messages.create(**kwargs)
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return _Response(text)


class _Chat:
    def __init__(self) -> None:
        self.completions = _Completions()


class _ClaudeClient:
    def __init__(self) -> None:
        self.chat = _Chat()


client = _ClaudeClient()
