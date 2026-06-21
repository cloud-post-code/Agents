"""Fake streaming LLM for use in tests and dev without API key."""
from __future__ import annotations

from typing import Any, AsyncIterator, Optional
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage, AIMessageChunk
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult


class FakeChatModel(BaseChatModel):
    """Returns a canned streaming response without calling any external API."""

    response: str = "I'm your Artisan AI co-worker. How can I help you today?"

    def _generate(self, messages: list[BaseMessage], stop: Optional[list[str]] = None, **kwargs: Any) -> ChatResult:
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=self.response))])

    async def _astream(  # type: ignore[override]
        self, messages: list[BaseMessage], stop: Optional[list[str]] = None, **kwargs: Any
    ) -> AsyncIterator[ChatGenerationChunk]:
        words = self.response.split()
        for i, word in enumerate(words):
            token = word + ("" if i == len(words) - 1 else " ")
            chunk = AIMessageChunk(content=token)
            yield ChatGenerationChunk(message=chunk)

    @property
    def _llm_type(self) -> str:
        return "fake-artisan"
