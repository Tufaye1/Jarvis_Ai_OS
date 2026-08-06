from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://jarvis:jarvis@localhost:5432/jarvis"
    api_port: int = 8000
    vault_path: Path = REPO_ROOT / "vault"

    # LLM — provider-agnostic. Defaults point at OpenRouter, but any
    # OpenAI-compatible endpoint (OpenAI direct, Groq, Together, local Ollama)
    # will work by changing base_url + model. See .env.example.
    llm_api_key: str = ""
    llm_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = "anthropic/claude-sonnet-5"


settings = Settings()
