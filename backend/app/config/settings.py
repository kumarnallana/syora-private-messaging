from functools import lru_cache
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = Field(alias="DATABASE_URL")
    jwt_access_secret: str = Field(min_length=32, alias="JWT_ACCESS_SECRET")
    jwt_refresh_secret: str = Field(min_length=32, alias="JWT_REFRESH_SECRET")
    access_token_minutes: int = Field(default=15, ge=10, le=20, alias="ACCESS_TOKEN_MINUTES")
    refresh_token_days: int = Field(default=30, ge=1, le=90, alias="REFRESH_TOKEN_DAYS")
    client_origins: list[str] = Field(alias="CLIENT_ORIGINS")
    app_frontend_url: str = Field(default="http://localhost:3000", alias="APP_FRONTEND_URL")
    resend_api_key: str = Field(default="", alias="RESEND_API_KEY")
    email_from: str = Field(default="noreply@resend.dev", alias="EMAIL_FROM")
    r2_account_id: str = Field(default="", alias="R2_ACCOUNT_ID")
    r2_access_key_id: str = Field(default="", alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str = Field(default="", alias="R2_SECRET_ACCESS_KEY")
    r2_bucket: str = Field(default="", alias="R2_BUCKET")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    admin_email: str = Field(default="", alias="SYORA_ADMIN_EMAIL")
    admin_bootstrap_password: str = Field(default="", alias="SYORA_ADMIN_BOOTSTRAP_PASSWORD")
    admin_display_name: str = Field(default="SYORA Admin", alias="SYORA_ADMIN_DISPLAY_NAME")
    admin_username: str = Field(default="syora_admin", alias="SYORA_ADMIN_USERNAME")

    @field_validator("database_url",mode="before")
    @classmethod
    def async_postgres_url(cls,value:str)->str:
        value=value.replace("postgres://","postgresql://",1)
        if value.startswith("postgresql://"):value=value.replace("postgresql://","postgresql+asyncpg://",1)
        return value.replace("sslmode=require","ssl=require")

    @field_validator("client_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: str) -> list[str]:
        if isinstance(value, str):
            return [o.strip() for o in value.split(",")]
        return value

    @property
    def production(self) -> bool:
        return self.environment.lower() == "production"

@lru_cache
def get_settings() -> Settings:
    return Settings()
