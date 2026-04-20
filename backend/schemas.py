from pydantic import BaseModel


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