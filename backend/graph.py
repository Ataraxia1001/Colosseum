import operator
from pathlib import Path
from typing import Annotated, Callable, Coroutine, Any

from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from schemas import CritiqueResponse, ModelResponse
from llm_clients import (
    ANTHROPIC_MODEL,
    GEMINI_MODEL,
    OPENAI_MODEL,
    call_claude,
    call_gemini,
    call_openai,
)


class ChatState(TypedDict):
    message: str
    responses: Annotated[list[ModelResponse], operator.add]
    critiques: Annotated[list[CritiqueResponse], operator.add]


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


def _build_critique_prompt(message: str, targets: list[ModelResponse]) -> str:
    responses_text = '\n\n'.join(
        f"{r.provider.upper()} ({r.model}):\n{r.content or f'[Error: {r.error}]'}"
        for r in targets
    )
    return (
        f'The following question was asked:\n"{message}"\n\n'
        f'Here are the responses:\n\n{responses_text}\n\n'
        'Critically evaluate these responses. Identify strengths, weaknesses, '
        'inaccuracies, and areas for improvement in each.'
    )


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


graph = StateGraph(ChatState)
graph.add_node('openai', openai_node)
graph.add_node('claude', claude_node)
graph.add_node('gemini', gemini_node)
graph.add_node('openai_critique', openai_critique_node)
graph.add_node('claude_critique', claude_critique_node)
graph.add_node('gemini_critique', gemini_critique_node)

# Phase 1: all three run in parallel from START
graph.add_edge(START, 'openai')
graph.add_edge(START, 'claude')
graph.add_edge(START, 'gemini')

# Phase 2: each model critiques the other two.
graph.add_edge('claude', 'openai_critique')
graph.add_edge('gemini', 'openai_critique')
graph.add_edge('openai', 'claude_critique')
graph.add_edge('gemini', 'claude_critique')
graph.add_edge('openai', 'gemini_critique')
graph.add_edge('claude', 'gemini_critique')

# End when all critiques are done.
graph.add_edge('openai_critique', END)
graph.add_edge('claude_critique', END)
graph.add_edge('gemini_critique', END)

chat_graph = graph.compile()


def save_graph_image(output_path: str | None = None) -> Path:
    artifacts_dir = Path(__file__).parent / 'artifacts'
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    image_path = Path(output_path) if output_path else artifacts_dir / 'chat_graph.png'
    png_data = chat_graph.get_graph().draw_mermaid_png()
    image_path.write_bytes(png_data)
    return image_path


if __name__ == '__main__':
    # Run this file to see the graph image in the artifacts directory
    saved_path = save_graph_image()
    print(f'Saved graph image: {saved_path}')