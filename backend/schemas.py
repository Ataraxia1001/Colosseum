from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str


class ModelResponse(BaseModel):
    model: str
    provider: str
    content: str | None = None
    error: str | None = None


class CritiqueResponse(BaseModel):
    model: str
    provider: str
    critiqued_providers: list[str]
    content: str | None = None
    error: str | None = None


class EvaluationResult(BaseModel):
    provider: str
    component: str  # "response" or "critique"
    scores: dict[str, float] = Field(default_factory=dict)
    judge_model: str | None = None
    contestants: list[str] = Field(default_factory=list)
    winner: str | None = None
    reason: str | None = None
    error: str | None = None
