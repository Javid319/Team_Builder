from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # Application
    app_name: str = "Hackathon Team Formation Platform"
    app_version: str = "1.0.0"
    debug: bool = True

    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Database
    database_url: str

    # Groq AI
    groq_api_key: str
    groq_model: str = "llama-3.3-70b-versatile"

    # File Upload
    upload_dir: str = "uploads/resumes"
    max_upload_size_mb: int = 5

    # CORS
    allowed_origins: str = "http://localhost:8000"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
