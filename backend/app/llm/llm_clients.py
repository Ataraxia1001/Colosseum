import asyncio
import os
from typing import Any
import httpx

from ..config_loader import get_config
from ..schemas import ModelResponse

_CONFIG = get_config()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

OPENAI_MODEL = _CONFIG.models.openai
ANTHROPIC_MODEL = _CONFIG.models.anthropic
GEMINI_MODEL = _CONFIG.models.gemini
GEMINI_TIMEOUT_SECONDS = _CONFIG.gemini.timeout_seconds
GEMINI_MAX_RETRIES = _CONFIG.gemini.max_retries
GEMINI_RETRY_BACKOFF_SECONDS = _CONFIG.gemini.retry_backoff_seconds

initial_opinion: list[ModelResponse] = []


def _gemini_error_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
        error = payload.get('error', {}) if isinstance(payload, dict) else {}
        if isinstance(error, dict):
            code = error.get('code')
            status = error.get('status')
            message = error.get('message')
            return ' - '.join(str(part) for part in (code, status, message) if part)
    except Exception:
        pass
    return (response.text or 'Unknown Gemini API error').strip()


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

    transient_statuses = {429, 500, 502, 503, 504}
    attempts = max(1, GEMINI_MAX_RETRIES)

    async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
        for attempt in range(1, attempts + 1):
            try:
                response = await client.post(url, json=payload)
            except httpx.HTTPError as exc:
                if attempt < attempts:
                    await asyncio.sleep(GEMINI_RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1)))
                    continue
                return ModelResponse(
                    provider='google',
                    model=GEMINI_MODEL,
                    error=f'Gemini network error after {attempts} attempts: {exc}',
                )

            if response.status_code == 200:
                data = response.json()
                break

            if response.status_code in transient_statuses and attempt < attempts:
                await asyncio.sleep(GEMINI_RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1)))
                continue

            return ModelResponse(
                provider='google',
                model=GEMINI_MODEL,
                error=f'Gemini API error {response.status_code}: {_gemini_error_message(response)}',
            )
        else:
            return ModelResponse(
                provider='google',
                model=GEMINI_MODEL,
                error=f'Gemini request exhausted retries ({attempts}).',
            )

    try:
        text = data['candidates'][0]['content']['parts'][0]['text']
    except Exception:
        text = 'No response text returned.'

    return ModelResponse(provider='google', model=GEMINI_MODEL, content=text)
