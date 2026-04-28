import os
from pathlib import Path
from uuid import uuid4

from schemas import ModelResponse


def build_chat_config() -> dict:
    run_config = {
        'run_name': 'colosseum_chat',
        'tags': ['colosseum', 'chat'],
        'metadata': {
            'endpoint': '/chat',
        },
        # Unique per request so traces are easier to distinguish in LangSmith.
        'configurable': {'thread_id': f'chat-{uuid4()}'},
    }

    # LangSmith tracing can be enabled via LANGSMITH_TRACING in the environment.
    if os.getenv('LANGSMITH_TRACING', '').lower() in {'1', 'true', 'yes'}:
        project = os.getenv('LANGSMITH_PROJECT')
        if project:
            run_config['metadata']['langsmith_project'] = project

    return run_config



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


def save_graph_image(graph, output_path: str | None = None) -> Path:
    artifacts_dir = Path(__file__).parent / 'artifacts'
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    image_path = Path(output_path) if output_path else artifacts_dir / 'chat_graph.png'
    png_data = graph.get_graph().draw_mermaid_png()
    image_path.write_bytes(png_data)
    return image_path