import llm_clients
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from llm_clients import ChatRequest, ModelResponse
from graph import chat_graph

app = FastAPI(title='Multi LLM MVP API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/chat')
async def chat(request: ChatRequest) -> dict[str, list[ModelResponse]]:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail='Message cannot be empty.')

    result = await chat_graph.ainvoke({'message': message, 'responses': []})
    normalized: list[ModelResponse] = result['responses']

    llm_clients.initial_opinion = normalized
    return {'responses': normalized}


@app.get('/results')
async def get_results() -> dict[str, list[ModelResponse]]:
    return {'responses': llm_clients.initial_opinion}
