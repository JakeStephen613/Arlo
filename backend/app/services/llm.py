"""Anthropic (Claude) LLM client.

Provides:
- OpenAI-shaped adapter for non-streaming calls (`client.chat.completions.create`)
- `stream_messages()` async generator for token-by-token SSE streaming
- `call_messages()` one-shot helper for simple non-streaming calls
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

from anthropic import Anthropic

from app.core.config import ANTHROPIC_API_KEY

MODEL = "claude-haiku-4-5"
DEFAULT_MAX_TOKENS = 8192

_client = Anthropic(api_key=ANTHROPIC_API_KEY)


# ── Helpers shared by adapter and streaming ────────────────────


def _split_messages(messages: list[dict[str, str]]) -> tuple[str, list[dict]]:
    system_parts = [m["content"] for m in messages if m["role"] == "system"]
    system = "\n\n".join(system_parts)
    convo = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m["role"] != "system"
    ]
    return system, convo


def _build_kwargs(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float | None = None,
    response_format: dict[str, Any] | None = None,
) -> dict[str, Any]:
    system, convo = _split_messages(messages)
    kwargs: dict[str, Any] = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": convo,
    }
    if system:
        kwargs["system"] = system
    if temperature is not None:
        kwargs["temperature"] = temperature
    if response_format:
        fmt_type = response_format.get("type")
        if fmt_type == "json_schema":
            schema = response_format["json_schema"]["schema"]
            kwargs["output_config"] = {
                "format": {"type": "json_schema", "schema": schema}
            }
        elif fmt_type == "json_object":
            kwargs["system"] = (
                (kwargs.get("system", "") + "\n\n") if kwargs.get("system") else ""
            ) + "Respond with a single valid JSON object and nothing else."
    return kwargs


# ── One-shot call ──────────────────────────────────────────────


def call_messages(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float | None = None,
    response_format: dict[str, Any] | None = None,
) -> str:
    kwargs = _build_kwargs(
        messages,
        max_tokens=max_tokens,
        temperature=temperature,
        response_format=response_format,
    )
    resp = _client.messages.create(**kwargs)
    return next((b.text for b in resp.content if b.type == "text"), "")


# ── Streaming (async generator) ───────────────────────────────


async def stream_messages(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    temperature: float | None = None,
) -> AsyncIterator[str]:
    """Yield text tokens as they arrive from Anthropic's streaming API."""
    kwargs = _build_kwargs(
        messages, max_tokens=max_tokens, temperature=temperature,
    )

    def _sync_stream():
        with _client.messages.stream(**kwargs) as stream:
            for text in stream.text_stream:
                yield text

    loop = asyncio.get_event_loop()
    import queue
    import threading

    q: queue.Queue[str | None] = queue.Queue()

    def _run():
        try:
            for token in _sync_stream():
                q.put(token)
        except Exception as exc:
            q.put(exc)
        finally:
            q.put(None)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    while True:
        item = await loop.run_in_executor(None, q.get)
        if item is None:
            break
        if isinstance(item, Exception):
            raise item
        yield item


# ── Legacy OpenAI-shaped adapter (used by blurting, review_sheet) ──


class _Message:
    def __init__(self, content: str) -> None:
        self.content = content


class _Choice:
    def __init__(self, content: str) -> None:
        self.message = _Message(content)


class _Response:
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
        model: str | None = None,
        **_ignored: Any,
    ) -> _Response:
        text = call_messages(
            messages,
            max_tokens=max_tokens,
            temperature=temperature,
            response_format=response_format,
        )
        return _Response(text)


class _Chat:
    def __init__(self) -> None:
        self.completions = _Completions()


class _ClaudeClient:
    def __init__(self) -> None:
        self.chat = _Chat()


client = _ClaudeClient()
