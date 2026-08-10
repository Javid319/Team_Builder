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

    # Groq AI (Supports up to 5 rotating keys)
    groq_api_key: str
    groq_api_key_2: str = ""
    groq_api_key_3: str = ""
    groq_api_key_4: str = ""
    groq_api_key_5: str = ""
    groq_api_keys: str = ""  # Optional comma-separated string of keys
    groq_model: str = "llama-3.3-70b-versatile"

    @property
    def groq_api_keys_list(self) -> List[str]:
        keys = []
        # Add comma-separated keys if provided
        if self.groq_api_keys.strip():
            for k in self.groq_api_keys.split(","):
                k_clean = k.strip()
                if k_clean and k_clean not in keys:
                    keys.append(k_clean)

        # Add individual key fields
        individual_keys = [
            self.groq_api_key,
            self.groq_api_key_2,
            self.groq_api_key_3,
            self.groq_api_key_4,
            self.groq_api_key_5,
        ]
        for k in individual_keys:
            k_clean = k.strip() if k else ""
            if k_clean and k_clean not in keys:
                keys.append(k_clean)

        # Cap strictly at 5 keys maximum
        return keys[:5]

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
