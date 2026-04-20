import os
from uuid import uuid4

import llm_clients
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import ChatRequest, CritiqueResponse, ModelResponse
from graph import chat_graph


app = FastAPI(title='Multi LLM MVP API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


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


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/chat')
async def chat(request: ChatRequest) -> dict:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail='Message cannot be empty.')

    result = await chat_graph.ainvoke(
        {'message': message, 'responses': [], 'critiques': []},
        config=build_chat_config(),
    )
    normalized: list[ModelResponse] = result['responses']
    critiques: list[CritiqueResponse] = result['critiques']

    llm_clients.initial_opinion = normalized

    return {'responses': normalized, 'critiques': critiques}


@app.get('/results')
async def get_results() -> dict[str, list[ModelResponse]]:
    return {'responses': llm_clients.initial_opinion}