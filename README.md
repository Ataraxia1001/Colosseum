# Multi LLM MVP

A minimal app where one user prompt is sent to OpenAI, Claude, and Gemini, then all three responses are shown in a single React chat-style UI.

## Stack

- Frontend: React + Vite
- Backend: FastAPI
- Providers: OpenAI, Anthropic Claude, Google Gemini

## Project structure

```text
multi-llm-mvp/
├── backend/
│   ├── main.py
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
└── README.md
```

## 1. Backend setup

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn main:app --reload
```

If this is your first time using uv, install it first:

```bash
pip install uv
```

Set your API keys in `backend/.env` before running.

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## 3. API

### POST `/chat`

Request body:

```json
{
  "message": "What is the difference between RAG and fine-tuning?"
}
```

Response:

```json
{
  "responses": [
    {
      "provider": "openai",
      "model": "gpt-4.1-mini",
      "content": "...",
      "error": null
    },
    {
      "provider": "anthropic",
      "model": "claude-3-5-haiku-latest",
      "content": "...",
      "error": null
    },
    {
      "provider": "google",
      "model": "gemini-2.0-flash",
      "content": "...",
      "error": null
    }
  ]
}
```

## Notes

- This is intentionally simple: one prompt in, three model outputs out.
- No streaming, auth, chat history, or database yet.
- The backend uses direct HTTP API calls to keep the MVP lightweight.
- You can later add debate mode, voting, synthesis, or conversation memory.
