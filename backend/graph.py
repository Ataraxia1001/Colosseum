import operator
from typing import Annotated

from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from llm_clients import (
    ANTHROPIC_MODEL,
    GEMINI_MODEL,
    OPENAI_MODEL,
    ModelResponse,
    call_claude,
    call_gemini,
    call_openai,
)


class ChatState(TypedDict):
    message: str
    responses: Annotated[list[ModelResponse], operator.add]


async def openai_node(state: ChatState) -> dict:
    try:
        result = await call_openai(state['message'])
    except Exception as exc:
        result = ModelResponse(provider='openai', model=OPENAI_MODEL, error=str(exc))
    return {'responses': [result]}


async def claude_node(state: ChatState) -> dict:
    try:
        result = await call_claude(state['message'])
    except Exception as exc:
        result = ModelResponse(provider='anthropic', model=ANTHROPIC_MODEL, error=str(exc))
    return {'responses': [result]}


async def gemini_node(state: ChatState) -> dict:
    try:
        result = await call_gemini(state['message'])
    except Exception as exc:
        result = ModelResponse(provider='google', model=GEMINI_MODEL, error=str(exc))
    return {'responses': [result]}


_graph_builder = StateGraph(ChatState)
_graph_builder.add_node('openai', openai_node)
_graph_builder.add_node('claude', claude_node)
_graph_builder.add_node('gemini', gemini_node)
for _node in ('openai', 'claude', 'gemini'):
    _graph_builder.add_edge(START, _node)
    _graph_builder.add_edge(_node, END)


chat_graph = _graph_builder.compile()