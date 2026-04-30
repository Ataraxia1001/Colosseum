import asyncio
from collections.abc import Iterable

from deepeval.metrics import ArenaGEval, GEval
from deepeval.models import AnthropicModel, DeepEvalBaseLLM, GeminiModel, GPTModel
from deepeval.test_case import ArenaTestCase, Contestant, LLMTestCase, LLMTestCaseParams, SingleTurnParams

from .llm_clients import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    GEMINI_API_KEY,
    GEMINI_MAX_RETRIES,
    GEMINI_MODEL,
    GEMINI_RETRY_BACKOFF_SECONDS,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)
from schemas import CritiqueResponse, EvaluationResult, ModelResponse


PROVIDER_LABELS = {
    'openai': 'OpenAI',
    'anthropic': 'Claude',
    'google': 'Gemini',
}

TRANSIENT_EVAL_ERROR_MARKERS = (
    ' 429 ',
    ' 500 ',
    ' 502 ',
    ' 503 ',
    ' 504 ',
    'unavailable',
    'high demand',
    'rate limit',
    'temporar',
)

def _provider_label(provider: str) -> str:
    return PROVIDER_LABELS.get(provider, provider.capitalize())


def _is_transient_eval_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in TRANSIENT_EVAL_ERROR_MARKERS)


def _eval_retry_settings() -> tuple[int, float]:
    return max(1, GEMINI_MAX_RETRIES), max(0.0, GEMINI_RETRY_BACKOFF_SECONDS)


async def _run_with_transient_retries(coro_factory):
    max_retries, backoff_seconds = _eval_retry_settings()
    for attempt in range(1, max_retries + 1):
        try:
            return await coro_factory()
        except Exception as exc:
            if attempt >= max_retries or not _is_transient_eval_error(exc):
                raise
            await asyncio.sleep(backoff_seconds * (2 ** (attempt - 1)))

    raise RuntimeError('Evaluation retries exhausted unexpectedly')


async def _measure_with_retries(metric: GEval, test_case: LLMTestCase) -> float:
    await _run_with_transient_retries(lambda: metric.a_measure(test_case))
    return metric.score


def _build_judge_llm(judge_provider: str, judge_model: str) -> DeepEvalBaseLLM:
    if judge_provider == 'anthropic':
        kwargs = {'model': judge_model}
        if ANTHROPIC_API_KEY:
            kwargs['api_key'] = ANTHROPIC_API_KEY
        return AnthropicModel(**kwargs)

    if judge_provider == 'google':
        kwargs = {'model': judge_model}
        if GEMINI_API_KEY:
            kwargs['api_key'] = GEMINI_API_KEY
        return GeminiModel(**kwargs)

    kwargs = {'model': judge_model}
    if OPENAI_API_KEY:
        kwargs['api_key'] = OPENAI_API_KEY
    return GPTModel(**kwargs)


def _make_GEval_metrics(judge_model: DeepEvalBaseLLM) -> dict[str, GEval]:
    """Return a fresh set of 4 custom GEval metrics backed by the given judge model."""
    shared_params = dict(
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
        model=judge_model,
    )
    return {
        'correctness': GEval(
            name='Correctness',
            criteria=(
                'Determine whether the actual output is factually correct and '
                'accurately answers the input question.'
            ),
            **shared_params,
        ),
        'completeness': GEval(
            name='Completeness',
            criteria=(
                'Determine whether the actual output fully and thoroughly '
                'addresses all aspects of the input question, leaving no '
                'important part unanswered.'
            ),
            **shared_params,
        ),
        'reasoning': GEval(
            name='Reasoning',
            criteria=(
                'Determine whether the actual output demonstrates clear, '
                'logical reasoning and well-structured argumentation, with '
                'conclusions that follow coherently from the evidence presented.'
            ),
            **shared_params,
        ),
        'clarity': GEval(
            name='Clarity',
            criteria=(
                'Determine whether the actual output is clearly written, '
                'well-organised, and easy to understand, with no unnecessary '
                'jargon or ambiguity.'
            ),
            **shared_params,
        ),
    }


def _make_arena_metric(
    judge_model: DeepEvalBaseLLM,
    component: str,
    contestants: tuple[str, str],
) -> ArenaGEval:
    left_label = _provider_label(contestants[0])
    right_label = _provider_label(contestants[1])
    criteria = (
        f'Choose the better {component} for the given user input. '
        'Prioritize factual correctness, completeness, reasoning quality, and clarity. '
        f'Return the winner between {left_label} and {right_label}.'
    )
    return ArenaGEval(
        name=f'{component.capitalize()} Pairwise Winner',
        criteria=criteria,
        evaluation_params=[SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
        model=judge_model,
        async_mode=True,
    )


def _normalize_winner(raw_winner: object, contestants: tuple[str, str]) -> str | None:
    if not raw_winner:
        return None

    winner_text = str(raw_winner).strip().lower()
    if winner_text in contestants:
        return winner_text

    aliases = {
        'claude': 'anthropic',
        'anthropic': 'anthropic',
        'gemini': 'google',
        'google': 'google',
        'openai': 'openai',
        'gpt': 'openai',
    }
    if winner_text in aliases and aliases[winner_text] in contestants:
        return aliases[winner_text]

    # Some judge outputs include provider/model text like
    # "ANTHROPIC (claude-...)" or "GOOGLE (gemini-...)".
    contains_match: list[str] = []
    if ('anthropic' in winner_text or 'claude' in winner_text) and 'anthropic' in contestants:
        contains_match.append('anthropic')
    if ('google' in winner_text or 'gemini' in winner_text) and 'google' in contestants:
        contains_match.append('google')
    if ('openai' in winner_text or 'gpt' in winner_text) and 'openai' in contestants:
        contains_match.append('openai')

    if len(contains_match) == 1:
        return contains_match[0]

    return None


def _unwrap_masked_name(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if text.startswith('$') and text.endswith('$') and len(text) > 2:
        return text[1:-1].strip()
    return text or None


def _resolve_masked_winner(
    masked_winner: object,
    dummy_to_real_names: dict[str, str],
    contestants: tuple[str, str],
) -> str | None:
    raw = _unwrap_masked_name(masked_winner)
    if not raw:
        return None

    if raw in dummy_to_real_names:
        return dummy_to_real_names[raw]

    lowered = raw.lower()
    for dummy_name, real_name in dummy_to_real_names.items():
        if dummy_name.lower() == lowered:
            return real_name

    # Fallback when judge outputs real/provider names instead of dummy names.
    return _normalize_winner(raw, contestants)


async def run_pairwise_arena_eval(
    *,
    judge_model: DeepEvalBaseLLM,
    judge_model_name: str,
    prompt: str,
    component: str,
    left_provider: str,
    left_model: str,
    left_output: str,
    right_provider: str,
    right_model: str,
    right_output: str,
) -> EvaluationResult:
    contestants = (left_provider, right_provider)
    metric = _make_arena_metric(
        judge_model=judge_model,
        component=component,
        contestants=contestants,
    )
    test_case = ArenaTestCase(
        contestants=[
            Contestant(
                name=left_provider,
                hyperparameters={'provider': left_provider, 'model': left_model},
                test_case=LLMTestCase(input=prompt, actual_output=left_output),
            ),
            Contestant(
                name=right_provider,
                hyperparameters={'provider': right_provider, 'model': right_model},
                test_case=LLMTestCase(input=prompt, actual_output=right_output),
            ),
        ]
    )

    # ArenaGEval may emit winner tokens like "$Charlie$" which can cause an
    # internal KeyError in deepeval when it maps masked names. We run the
    # compare steps directly and normalize the winner ourselves.
    if hasattr(metric, '_a_generate_evaluation_steps') and hasattr(metric, '_a_compare'):
        metric.evaluation_steps = await _run_with_transient_retries(
            lambda: metric._a_generate_evaluation_steps(test_case.multimodal)
        )
        masked_winner, masked_reason, dummy_to_real_names = await _run_with_transient_retries(
            lambda: metric._a_compare(test_case, test_case.multimodal)
        )
        winner = _resolve_masked_winner(masked_winner, dummy_to_real_names, contestants)
        if hasattr(metric, '_a_generate_rewritten_reason'):
            reason = await _run_with_transient_retries(
                lambda: metric._a_generate_rewritten_reason(masked_reason, dummy_to_real_names)
            )
        else:
            reason = masked_reason
    else:
        if hasattr(metric, 'a_measure'):
            await _run_with_transient_retries(lambda: metric.a_measure(test_case))
        else:
            await asyncio.to_thread(metric.measure, test_case)
        winner = _normalize_winner(getattr(metric, 'winner', None), contestants)
        reason = getattr(metric, 'reason', None)

    return EvaluationResult(
        provider='pairwise',
        component=component,
        judge_model=judge_model_name,
        contestants=[left_provider, right_provider],
        winner=winner,
        reason=reason,
    )


def _get_model_name(provider: str, response: ModelResponse | None) -> str:
    if response:
        return response.model
    if provider == 'openai':
        return OPENAI_MODEL
    if provider == 'anthropic':
        return ANTHROPIC_MODEL
    return GEMINI_MODEL


async def _evaluate_metrics(
    *,
    message: str,
    chat_by_provider: dict[str, tuple[ModelResponse | None, CritiqueResponse | None]],
    judge_provider: str,
    judge_model: str,
    evaluate_providers: Iterable[str],
) -> list[EvaluationResult]:
    evaluations: list[EvaluationResult] = []
    judge_llm = _build_judge_llm(judge_provider, judge_model)

    for provider in evaluate_providers:
        response, critique = chat_by_provider[provider]

        for component, content in [
            ('response', response.content if response else None),
            ('critique', critique.content if critique else None),
        ]:
            if not content:
                evaluations.append(EvaluationResult(
                    provider=provider,
                    component=component,
                    error='No content available to evaluate',
                ))
                continue

            test_case = LLMTestCase(input=message, actual_output=content)
            metrics = _make_GEval_metrics(judge_llm)
            scores: dict[str, float] = {}
            metric_errors: dict[str, str] = {}

            for metric_name, metric in metrics.items():
                try:
                    scores[metric_name] = await _measure_with_retries(metric, test_case)
                except Exception as exc:
                    metric_errors[metric_name] = str(exc)

            evaluations.append(EvaluationResult(
                provider=provider,
                component=component,
                scores=scores,
                judge_model=judge_model,
                error='; '.join(f'{k}: {v}' for k, v in metric_errors.items()) or None,
            ))

    return evaluations


async def _evaluate_pairwise(
    *,
    message: str,
    chat_by_provider: dict[str, tuple[ModelResponse | None, CritiqueResponse | None]],
    judge_provider: str,
    judge_model: str,
    contestants: tuple[str, str],
) -> list[EvaluationResult]:
    evaluations: list[EvaluationResult] = []
    judge_llm = _build_judge_llm(judge_provider, judge_model)
    left_provider, right_provider = contestants
    left_response, _ = chat_by_provider[left_provider]
    right_response, _ = chat_by_provider[right_provider]
    left_content = left_response.content if left_response else None
    right_content = right_response.content if right_response else None

    if not left_content or not right_content:
        return [EvaluationResult(
            provider='pairwise',
            component='response',
            judge_model=judge_model,
            contestants=[left_provider, right_provider],
            error=(
                f'Missing {_provider_label(left_provider)} or '
                f'{_provider_label(right_provider)} response content for pairwise evaluation'
            ),
        )]

    try:
        evaluations.append(
            await run_pairwise_arena_eval(
                judge_model=judge_llm,
                judge_model_name=judge_model,
                prompt=message,
                component='response',
                left_provider=left_provider,
                left_model=_get_model_name(left_provider, left_response),
                left_output=left_content,
                right_provider=right_provider,
                right_model=_get_model_name(right_provider, right_response),
                right_output=right_content,
            )
        )
    except Exception as exc:
        evaluations.append(EvaluationResult(
            provider='pairwise',
            component='response',
            judge_model=judge_model,
            contestants=[left_provider, right_provider],
            error=str(exc),
        ))

    return evaluations
