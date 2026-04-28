from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams


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
