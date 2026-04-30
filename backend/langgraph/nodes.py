import operator
from typing import Annotated, Callable, Coroutine, Any

from typing_extensions import TypedDict

from schemas import CritiqueResponse, EvaluationResult, ModelResponse
from llm.llm_clients import (
    ANTHROPIC_MODEL,
    GEMINI_MODEL,
    OPENAI_MODEL,
    call_claude,
    call_gemini,
    call_openai,
)
from llm.eval import _evaluate_metrics, _evaluate_pairwise
from utils import _build_critique_prompt


class ChatState(TypedDict):
    message: str
    responses: Annotated[list[ModelResponse], operator.add]
    critiques: Annotated[list[CritiqueResponse], operator.add]
    evaluations: Annotated[list[EvaluationResult], operator.add]


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


def _make_critique_node(
    critics_llm: str,
    target_llm: tuple[str, ...],
    call_fn: Callable[[str], Coroutine[Any, Any, ModelResponse]],
    fallback_model: str,
):
    async def critique_node(state: ChatState) -> dict:
        targets = [r for r in state['responses'] if r.provider in target_llm]
        try:
            prompt = _build_critique_prompt(state['message'], targets)
            response = await call_fn(prompt)
            result = CritiqueResponse(
                provider=critics_llm,
                model=response.model,
                critiqued_providers=[r.provider for r in targets],
                content=response.content,
                error=response.error,
            )
        except Exception as exc:
            result = CritiqueResponse(
                provider=critics_llm,
                model=fallback_model,
                critiqued_providers=[r.provider for r in targets],
                error=str(exc),
            )
        return {'critiques': [result]}

    return critique_node


openai_critique_node = _make_critique_node('openai', ('anthropic', 'google'), call_openai, OPENAI_MODEL)
claude_critique_node = _make_critique_node('anthropic', ('openai', 'google'), call_claude, ANTHROPIC_MODEL)
gemini_critique_node = _make_critique_node('google', ('openai', 'anthropic'), call_gemini, GEMINI_MODEL)


async def evaluation_node(state: ChatState) -> dict:
    """Use OpenAI as LLM-as-a-Judge to evaluate Claude and Gemini responses and critiques."""
    chat_by_provider: dict[str, tuple[ModelResponse | None, CritiqueResponse | None]] = {
        provider: (
            next((r for r in state['responses'] if r.provider == provider), None),
            next((c for c in state['critiques'] if c.provider == provider), None),
        )
        for provider in ('openai', 'anthropic', 'google')
    }
    metrics_evaluations = await _evaluate_metrics(
        message=state['message'],
        chat_by_provider=chat_by_provider,
    )
    pairwise_evaluations = await _evaluate_pairwise(
        message=state['message'],
        chat_by_provider=chat_by_provider,
    )

    return {'evaluations': metrics_evaluations + pairwise_evaluations}
