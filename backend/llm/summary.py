from collections import Counter

from schemas import EvaluationResult, ModelResponse, SummaryResult
from llm.llm_clients import call_openai


def _compute_winner_and_tie(evaluations: list[EvaluationResult]) -> tuple[str | None, bool]:
    """Return a single winner if clear; otherwise mark tie."""
    votes: Counter[str] = Counter(
        e.winner for e in evaluations if e.winner
    )
    if not votes:
        return None, False
    top_count = votes.most_common(1)[0][1]
    top_providers = [provider for provider, count in votes.items() if count == top_count]
    if len(top_providers) == 1:
        return top_providers[0], False
    return None, True


async def generate_summary(
    message: str,
    responses: list[ModelResponse],
    evaluations: list[EvaluationResult],
) -> SummaryResult:
    winner, is_tie = _compute_winner_and_tie(evaluations)

    opinions = '\n\n'.join(
        f'### {r.provider.capitalize()}\n{r.content}'
        for r in responses
        if r.content
    )
    prompt = (
        f'Three AI models answered the following question: "{message}"\n\n'
        f'{opinions}\n\n'
        'Write exactly three sentences. Each sentence summarizes one model\'s answer. '
        'Label each sentence with the model name at the start, e.g. "OpenAI: ...", "Claude: ...", "Gemini: ...".\n\n'
        'IMPORTANT: Respond in the exact same language as the question above.'
    )

    try:
        result = await call_openai(prompt)
        if result.error:
            return SummaryResult(winner=winner, is_tie=is_tie, error=result.error)
        return SummaryResult(summary=result.content, winner=winner, is_tie=is_tie)

    except Exception as exc:
        return SummaryResult(winner=winner, is_tie=is_tie, error=str(exc))
