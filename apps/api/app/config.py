from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://jarvis:jarvis@localhost:5432/jarvis"
    api_port: int = 8000
    vault_path: Path = REPO_ROOT / "vault"

    # LLM — provider-agnostic. Any OpenAI-compatible endpoint (OpenAI, Groq,
    # OpenRouter, Google Gemini's OpenAI-compat endpoint, local Ollama) works.
    # See .env.example.
    llm_api_key: str = ""
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = "anthropic/claude-sonnet-5"

    # Optional ordered fallback providers, tried after the primary on retriable
    # errors (429 rate limit, 5xx, timeout, 401 bad key, 402 out of credits).
    # JSON list of {"api_key": "...", "base_url": "...", "model": "..."}.
    # Empty list = single-provider mode.
    llm_fallbacks: list[dict] = []


settings = Settings()
