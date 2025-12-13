"""
Homepage Dashboard - Configuration
"""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    # Application
    app_name: str = "Homepage Dashboard"
    debug: bool = False
    
    # Security
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./data/homepage.db"
    
    # Gemini AI
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.5-flash-preview-05-20"
    
    # Weather API (OpenWeatherMap)
    weather_api_key: Optional[str] = None
    weather_units: str = "imperial"  # or "metric"
    
    # Proxmox
    proxmox_host: Optional[str] = None
    proxmox_user: Optional[str] = None
    proxmox_token_name: Optional[str] = None
    proxmox_token_value: Optional[str] = None
    proxmox_verify_ssl: bool = False
    
    # Docker
    docker_host: Optional[str] = None  # None = use local socket
    
    @property
    def is_gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)
    
    @property
    def is_weather_configured(self) -> bool:
        return bool(self.weather_api_key)
    
    @property
    def is_proxmox_configured(self) -> bool:
        return all([
            self.proxmox_host,
            self.proxmox_user,
            self.proxmox_token_name,
            self.proxmox_token_value
        ])


settings = Settings()
