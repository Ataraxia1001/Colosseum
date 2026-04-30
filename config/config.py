import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv


@dataclass(frozen=True)
class ModelConfig:
    openai: str
    anthropic: str
    gemini: str


@dataclass(frozen=True)
class GeminiConfig:
    timeout_seconds: float
    max_retries: int
    retry_backoff_seconds: float


@dataclass(frozen=True)
class LangSmithConfig:
    tracing: bool
    project: str
    endpoint: str


@dataclass(frozen=True)
class AppConfig:
    models: ModelConfig
    gemini: GeminiConfig
    langsmith: LangSmithConfig


_DEFAULT_CONFIG: dict[str, Any] = {
    'models': {
        'openai': 'gpt-4.1-mini',
        'anthropic': 'claude-haiku-4-5-20251001',
        'gemini': 'gemini-2.5-flash',
    },
    'gemini': {
        'timeout_seconds': 30,
        'max_retries': 3,
        'retry_backoff_seconds': 1.0,
    },
    'langsmith': {
        'tracing': True,
        'project': 'colosseum',
        'endpoint': 'https://api.smith.langchain.com',
    },
}

_CONFIG: AppConfig | None = None


def _as_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    if value is None:
        return default
    return bool(value)


def _load_raw_config() -> dict[str, Any]:
    config_path = Path(os.getenv('COLOSSEUM_CONFIG_PATH', Path(__file__).parent / 'config.yaml'))
    if not config_path.exists():
        return _DEFAULT_CONFIG

    with config_path.open('r', encoding='utf-8') as config_file:
        loaded = yaml.safe_load(config_file) or {}
    if not isinstance(loaded, dict):
        return _DEFAULT_CONFIG

    return {
        **_DEFAULT_CONFIG,
        **loaded,
        'models': {
            **_DEFAULT_CONFIG['models'],
            **(loaded.get('models') or {}),
        },
        'gemini': {
            **_DEFAULT_CONFIG['gemini'],
            **(loaded.get('gemini') or {}),
        },
        'langsmith': {
            **_DEFAULT_CONFIG['langsmith'],
            **(loaded.get('langsmith') or {}),
        },
    }


def _apply_langsmith_environment(langsmith: LangSmithConfig) -> None:
    os.environ['LANGSMITH_TRACING'] = 'true' if langsmith.tracing else 'false'
    os.environ['LANGSMITH_PROJECT'] = langsmith.project
    os.environ['LANGSMITH_ENDPOINT'] = langsmith.endpoint


def get_config() -> AppConfig:
    global _CONFIG
    if _CONFIG is not None:
        return _CONFIG

    # Keep .env support for local runs, but non-secret settings come from YAML.
    load_dotenv()
    raw = _load_raw_config()

    models_raw = raw.get('models', {})
    gemini_raw = raw.get('gemini', {})
    langsmith_raw = raw.get('langsmith', {})

    _CONFIG = AppConfig(
        models=ModelConfig(
            openai=str(models_raw.get('openai', _DEFAULT_CONFIG['models']['openai'])),
            anthropic=str(models_raw.get('anthropic', _DEFAULT_CONFIG['models']['anthropic'])),
            gemini=str(models_raw.get('gemini', _DEFAULT_CONFIG['models']['gemini'])),
        ),
        gemini=GeminiConfig(
            timeout_seconds=float(gemini_raw.get('timeout_seconds', _DEFAULT_CONFIG['gemini']['timeout_seconds'])),
            max_retries=int(gemini_raw.get('max_retries', _DEFAULT_CONFIG['gemini']['max_retries'])),
            retry_backoff_seconds=float(
                gemini_raw.get(
                    'retry_backoff_seconds',
                    _DEFAULT_CONFIG['gemini']['retry_backoff_seconds'],
                )
            ),
        ),
        langsmith=LangSmithConfig(
            tracing=_as_bool(langsmith_raw.get('tracing'), _DEFAULT_CONFIG['langsmith']['tracing']),
            project=str(langsmith_raw.get('project', _DEFAULT_CONFIG['langsmith']['project'])),
            endpoint=str(langsmith_raw.get('endpoint', _DEFAULT_CONFIG['langsmith']['endpoint'])),
        ),
    )

    _apply_langsmith_environment(_CONFIG.langsmith)
    return _CONFIG
