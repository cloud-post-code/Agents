"""Base Artisan agent using LangGraph for structured conversation flow."""
from __future__ import annotations

import os
import uuid
from typing import AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.language_models import BaseChatModel

from app.agents.prompts import AGENT_SYSTEM_PROMPTS, VALID_ROLES
from app.agents.tools import SHARED_TOOLS, PRODUCT_MANAGER_TOOLS


def get_tools_for_role(role: str) -> list:
    if role == "product_manager":
        return PRODUCT_MANAGER_TOOLS
    return SHARED_TOOLS


def get_llm(role: str) -> BaseChatModel:
    """Return LLM instance. Falls back to fake LLM in test/no-key environment."""
    import logging
    from app.core.config import settings

    # Read from settings (which merges Railway env vars) then fall back to os.environ
    api_key = settings.openai_api_key or os.environ.get("OPENAI_API_KEY", "")
    app_env = settings.app_env
    logging.warning(f"[get_llm] role={role} app_env={app_env} key_prefix={api_key[:7] if api_key else 'MISSING'}")

    if not api_key or api_key.startswith("sk-test") or app_env == "test":
        logging.warning("[get_llm] using FakeChatModel")
        from app.agents.fake_llm import FakeChatModel
        return FakeChatModel()

    logging.warning("[get_llm] using ChatOpenAI gpt-4o-mini")
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model="gpt-4o-mini", streaming=True, temperature=0.7, api_key=api_key)


class ArtisanAgent:
    """Simple streaming agent for one turn of conversation."""

    def __init__(self, role: str):
        if role not in VALID_ROLES:
            raise ValueError(f"Invalid agent role: {role}")
        self.role = role
        self.system_prompt = AGENT_SYSTEM_PROMPTS[role]
        self.tools = get_tools_for_role(role)
        self.llm = get_llm(role)

    async def stream(self, user_message: str, history: list[dict]) -> AsyncIterator[str]:
        """Stream response tokens for a user message given conversation history."""
        messages = [SystemMessage(content=self.system_prompt)]

        for msg in history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))

        messages.append(HumanMessage(content=user_message))

        async for chunk in self.llm.astream(messages):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content
