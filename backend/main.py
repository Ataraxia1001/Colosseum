import asyncio
import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title='Multi LLM MVP API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4.1-mini')
ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')


class ChatRequest(BaseModel):
    message: str


class ModelResponse(BaseModel):
    model: str
    provider: str
    content: str | None = None
    error: str | None = None


async def call_openai(message: str) -> ModelResponse:
    if not OPENAI_API_KEY:
        return ModelResponse(provider='openai', model=OPENAI_MODEL, error='Missing OPENAI_API_KEY')

    headers = {
        'Authorization': f'Bearer {OPENAI_API_KEY}',
        'Content-Type': 'application/json',
    }
    payload: dict[str, Any] = {
        'model': OPENAI_MODEL,
        'input': message,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post('https://api.openai.com/v1/responses', headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    content = data.get('output_text')
    if not content:
        try:
            content = data['output'][0]['content'][0]['text']
        except Exception:
            content = 'No response text returned.'

    return ModelResponse(provider='openai', model=OPENAI_MODEL, content=content)

async def call_claude(message: str) -> ModelResponse:
    if not ANTHROPIC_API_KEY:
        return ModelResponse(
            provider='anthropic',
            model=ANTHROPIC_MODEL,
            error='Missing ANTHROPIC_API_KEY'
        )

    headers = {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
    }

    payload = {
        'model': ANTHROPIC_MODEL,
        'max_tokens': 700,
        'messages': [
            {'role': 'user', 'content': message}
        ],
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            'https://api.anthropic.com/v1/messages',
            headers=headers,
            json=payload,
        )

        if response.status_code != 200:
            return ModelResponse(
                provider='anthropic',
                model=ANTHROPIC_MODEL,
                error=f'{response.status_code}: {response.text}'
            )

        data = response.json()

    content_blocks = data.get('content', [])
    text = ''.join(
        block.get('text', '')
        for block in content_blocks
        if block.get('type') == 'text'
    )

    return ModelResponse(
        provider='anthropic',
        model=ANTHROPIC_MODEL,
        content=text or 'No response text returned.'
    )

async def call_gemini(message: str) -> ModelResponse:
    if not GEMINI_API_KEY:
        return ModelResponse(provider='google', model=GEMINI_MODEL, error='Missing GEMINI_API_KEY')

    url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        f'{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}'
    )
    payload = {
        'contents': [
            {
                'parts': [{'text': message}],
            }
        ]
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    try:
        text = data['candidates'][0]['content']['parts'][0]['text']
    except Exception:
        text = 'No response text returned.'

    return ModelResponse(provider='google', model=GEMINI_MODEL, content=text)


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/chat')
async def chat(request: ChatRequest) -> dict[str, list[ModelResponse]]:
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail='Message cannot be empty.')

    results = await asyncio.gather(
        call_openai(message),
        call_claude(message),
        call_gemini(message),
        return_exceptions=True,
    )

    normalized: list[ModelResponse] = []
    for provider_name, result, model_name in [
        ('openai', results[0], OPENAI_MODEL),
        ('anthropic', results[1], ANTHROPIC_MODEL),
        ('google', results[2], GEMINI_MODEL),
    ]:
        if isinstance(result, Exception):
            normalized.append(ModelResponse(provider=provider_name, model=model_name, error=str(result)))
        else:
            normalized.append(result)

    return {'responses': normalized}
