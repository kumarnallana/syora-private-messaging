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
    client_origin: str = Field(alias="CLIENT_ORIGIN")
    r2_account_id: str = Field(default="", alias="R2_ACCOUNT_ID")
    r2_access_key_id: str = Field(default="", alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str = Field(default="", alias="R2_SECRET_ACCESS_KEY")
    r2_bucket: str = Field(default="", alias="R2_BUCKET")
    environment: str = Field(default="development", alias="ENVIRONMENT")

    @field_validator("database_url",mode="before")
    @classmethod
    def async_postgres_url(cls,value:str)->str:
        value=value.replace("postgres://","postgresql://",1)
        if value.startswith("postgresql://"):value=value.replace("postgresql://","postgresql+asyncpg://",1)
        return value.replace("sslmode=require","ssl=require")

    @property
    def production(self) -> bool:
        return self.environment.lower() == "production"

@lru_cache
def get_settings() -> Settings:
    return Settings()
