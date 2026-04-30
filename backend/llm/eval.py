import asyncio

from deepeval.metrics import ArenaGEval, GEval
from deepeval.test_case import ArenaTestCase, Contestant, LLMTestCase, LLMTestCaseParams, SingleTurnParams

from .llm_clients import ANTHROPIC_MODEL, GEMINI_MODEL, OPENAI_MODEL
from schemas import CritiqueResponse, EvaluationResult, ModelResponse


def _make_GEval_metrics(judge_model: str) -> dict[str, GEval]:
    """Return a fresh set of 4 custom GEval metrics backed by the given OpenAI model."""
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


def _make_arena_metric(judge_model: str, component: str) -> ArenaGEval:
    criteria = (
        f'Choose the better {component} for the given user input. '
        'Prioritize factual correctness, completeness, reasoning quality, and clarity. '
        'Return the winner between Claude and Gemini.'
    )
    return ArenaGEval(
        name=f'{component.capitalize()} Pairwise Winner',
        criteria=criteria,
        evaluation_params=[SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
        model=judge_model,
        async_mode=True,
    )


def _normalize_winner(raw_winner: object) -> str | None:
    if not raw_winner:
        return None

    winner_text = str(raw_winner).strip().lower()
    if winner_text in {'claude', 'gemini'}:
        return winner_text

    # Some judge outputs include provider/model text like
    # "ANTHROPIC (claude-...)" or "GOOGLE (gemini-...)".
    if 'anthropic' in winner_text or 'claude' in winner_text:
        return 'claude'
    if 'google' in winner_text or 'gemini' in winner_text:
        return 'gemini'

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
    return _normalize_winner(raw)


async def run_pairwise_arena_eval(
    *,
    judge_model: str,
    prompt: str,
    component: str,
    claude_model: str,
    claude_output: str,
    gemini_model: str,
    gemini_output: str,
) -> EvaluationResult:
    metric = _make_arena_metric(judge_model=judge_model, component=component)
    test_case = ArenaTestCase(
        contestants=[
            Contestant(
                name='claude',
                hyperparameters={'provider': 'anthropic', 'model': claude_model},
                test_case=LLMTestCase(input=prompt, actual_output=claude_output),
            ),
            Contestant(
                name='gemini',
                hyperparameters={'provider': 'google', 'model': gemini_model},
                test_case=LLMTestCase(input=prompt, actual_output=gemini_output),
            ),
        ]
    )

    # ArenaGEval may emit winner tokens like "$Charlie$" which can cause an
    # internal KeyError in deepeval when it maps masked names. We run the
    # compare steps directly and normalize the winner ourselves.
    if hasattr(metric, '_a_generate_evaluation_steps') and hasattr(metric, '_a_compare'):
        metric.evaluation_steps = await metric._a_generate_evaluation_steps(test_case.multimodal)
        masked_winner, masked_reason, dummy_to_real_names = await metric._a_compare(
            test_case,
            test_case.multimodal,
        )
        winner = _normalize_winner(_resolve_masked_winner(masked_winner, dummy_to_real_names))
        if hasattr(metric, '_a_generate_rewritten_reason'):
            reason = await metric._a_generate_rewritten_reason(masked_reason, dummy_to_real_names)
        else:
            reason = masked_reason
    else:
        if hasattr(metric, 'a_measure'):
            await metric.a_measure(test_case)
        else:
            await asyncio.to_thread(metric.measure, test_case)
        winner = _normalize_winner(getattr(metric, 'winner', None))
        reason = getattr(metric, 'reason', None)

    return EvaluationResult(
        provider='pairwise',
        component=component,
        judge_model=judge_model,
        contestants=['claude', 'gemini'],
        winner=winner,
        reason=reason,
    )


async def _evaluate_metrics(
    *,
    message: str,
    chat_by_provider: dict[str, tuple[ModelResponse | None, CritiqueResponse | None]],
) -> list[EvaluationResult]:
    evaluations: list[EvaluationResult] = []

    for provider in ('anthropic', 'google'):
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
            metrics = _make_GEval_metrics(OPENAI_MODEL)
            scores: dict[str, float] = {}
            metric_errors: dict[str, str] = {}

            for metric_name, metric in metrics.items():
                try:
                    await metric.a_measure(test_case)
                    scores[metric_name] = metric.score
                except Exception as exc:
                    metric_errors[metric_name] = str(exc)

            evaluations.append(EvaluationResult(
                provider=provider,
                component=component,
                scores=scores,
                error='; '.join(f'{k}: {v}' for k, v in metric_errors.items()) or None,
            ))

    return evaluations


async def _evaluate_pairwise(
    *,
    message: str,
    chat_by_provider: dict[str, tuple[ModelResponse | None, CritiqueResponse | None]],
) -> list[EvaluationResult]:
    evaluations: list[EvaluationResult] = []
    claude_response, _ = chat_by_provider['anthropic']
    gemini_response, _ = chat_by_provider['google']
    claude_content = claude_response.content if claude_response else None
    gemini_content = gemini_response.content if gemini_response else None

    if not claude_content or not gemini_content:
        return [EvaluationResult(
            provider='pairwise',
            component='response',
            judge_model=OPENAI_MODEL,
            contestants=['claude', 'gemini'],
            error='Missing Claude or Gemini response content for pairwise evaluation',
        )]

    try:
        evaluations.append(
            await run_pairwise_arena_eval(
                judge_model=OPENAI_MODEL,
                prompt=message,
                component='response',
                claude_model=claude_response.model if claude_response else ANTHROPIC_MODEL,
                claude_output=claude_content,
                gemini_model=gemini_response.model if gemini_response else GEMINI_MODEL,
                gemini_output=gemini_content,
            )
        )
    except Exception as exc:
        evaluations.append(EvaluationResult(
            provider='pairwise',
            component='response',
            judge_model=OPENAI_MODEL,
            contestants=['claude', 'gemini'],
            error=str(exc),
        ))

    return evaluations
