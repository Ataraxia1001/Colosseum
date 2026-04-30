from llm import llm_clients
import json
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from schemas import ChatRequest, CritiqueResponse, EvaluationResult, ModelResponse, SummaryResult
from arena_graph import chat_graph
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
        {'message': message, 'responses': [], 'critiques': [], 'evaluations': [], 'summary': None},
        config=build_chat_config(),
    )
    normalized: list[ModelResponse] = result['responses']
    critiques: list[CritiqueResponse] = result['critiques']
    evaluations: list[EvaluationResult] = result.get('evaluations', [])
    summary: SummaryResult | None = result.get('summary')

    llm_clients.initial_opinion = normalized

    return {
        'responses': normalized,
        'critiques': critiques,
        'evaluations': evaluations,
        'summary': summary,
    }


@app.post('/chat/stream')
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail='Message cannot be empty.')

    async def event_generator():
        aggregated_responses: list[ModelResponse] = []
        aggregated_critiques: list[CritiqueResponse] = []
        aggregated_evaluations: list[EvaluationResult] = []
        aggregated_summary: SummaryResult | None = None

        initial_state = {
            'message': message,
            'responses': [],
            'critiques': [],
            'evaluations': [],
            'summary': None,
        }

        try:
            async for chunk in chat_graph.astream(
                initial_state,
                config=build_chat_config(),
                stream_mode='updates',
            ):
                for node_name, payload in chunk.items():
                    event: dict = {
                        'type': 'node_update',
                        'node': node_name,
                    }

                    if 'responses' in payload:
                        responses = payload['responses']
                        aggregated_responses.extend(responses)
                        llm_clients.initial_opinion = aggregated_responses
                        event['responses'] = responses

                    if 'critiques' in payload:
                        critiques = payload['critiques']
                        aggregated_critiques.extend(critiques)
                        event['critiques'] = critiques

                    if 'evaluations' in payload:
                        evaluations = payload['evaluations']
                        aggregated_evaluations.extend(evaluations)
                        event['evaluations'] = evaluations

                    if 'summary' in payload:
                        aggregated_summary = payload['summary']
                        event['summary'] = aggregated_summary

                    yield f"data: {json.dumps(jsonable_encoder(event))}\n\n"

            done_event = {
                'type': 'done',
                'responses': aggregated_responses,
                'critiques': aggregated_critiques,
                'evaluations': aggregated_evaluations,
                'summary': aggregated_summary,
            }
            yield f"data: {json.dumps(jsonable_encoder(done_event))}\n\n"

        except Exception as exc:
            error_event = {
                'type': 'error',
                'error': str(exc),
            }
            yield f"data: {json.dumps(jsonable_encoder(error_event))}\n\n"

    return StreamingResponse(event_generator(), media_type='text/event-stream')


@app.get('/results')
async def get_results() -> dict[str, list[ModelResponse]]:
    return {'responses': llm_clients.initial_opinion}