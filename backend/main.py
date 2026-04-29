import llm_clients
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import ChatRequest, CritiqueResponse, EvaluationResult, ModelResponse
from graph import chat_graph
from utils import build_chat_config


app = FastAPI(title='Multi LLM MVP API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/chat')
async def chat(request: ChatRequest) -> dict:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail='Message cannot be empty.')

    result = await chat_graph.ainvoke(
        {'message': message, 'responses': [], 'critiques': [], 'evaluations': []},
        config=build_chat_config(),
    )
    normalized: list[ModelResponse] = result['responses']
    critiques: list[CritiqueResponse] = result['critiques']
    evaluations: list[EvaluationResult] = result.get('evaluations', [])

    llm_clients.initial_opinion = normalized

    return {
        'responses': normalized,
        'critiques': critiques,
        'evaluations': evaluations,
    }


@app.get('/results')
async def get_results() -> dict[str, list[ModelResponse]]:
    return {'responses': llm_clients.initial_opinion}