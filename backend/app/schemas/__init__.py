"""Schemas package."""
from app.schemas.schemas import (
    UserCreate, UserLogin, UserResponse, UserUpdate, Token, TokenData,
    DashboardCreate, DashboardUpdate, DashboardResponse,
    WidgetCreate, WidgetUpdate, WidgetPositionUpdate, WidgetResponse,
    LinkCreate, LinkUpdate, LinkResponse, LinkPreviewResponse,
    NoteCreate, NoteUpdate, NoteResponse,
    IntegrationCreate, IntegrationUpdate, IntegrationResponse,
    WeatherCurrent, WeatherForecastDay, WeatherResponse,
    DockerContainer, DockerResponse,
    ProxmoxVM, ProxmoxNode, ProxmoxResponse,
    CategorizeLinkRequest, CategorizeLinkResponse, SuggestTagsResponse,
    ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest
)

__all__ = [
    "UserCreate", "UserLogin", "UserResponse", "UserUpdate", "Token", "TokenData",
    "DashboardCreate", "DashboardUpdate", "DashboardResponse",
    "WidgetCreate", "WidgetUpdate", "WidgetPositionUpdate", "WidgetResponse",
    "LinkCreate", "LinkUpdate", "LinkResponse", "LinkPreviewResponse",
    "NoteCreate", "NoteUpdate", "NoteResponse",
    "IntegrationCreate", "IntegrationUpdate", "IntegrationResponse",
    "WeatherCurrent", "WeatherForecastDay", "WeatherResponse",
    "DockerContainer", "DockerResponse",
    "ProxmoxVM", "ProxmoxNode", "ProxmoxResponse",
    "CategorizeLinkRequest", "CategorizeLinkResponse", "SuggestTagsResponse",
    "ForgotPasswordRequest", "ResetPasswordRequest", "ChangePasswordRequest"
]
