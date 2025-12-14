"""
Homepage Dashboard - Pydantic Schemas
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ============== Auth Schemas ==============

class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    username: str
    is_active: bool
    is_admin: bool
    theme: str
    default_weather_location: Optional[str]
    created_at: datetime


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    theme: Optional[str] = Field(None, pattern="^(light|dark|system)$")
    default_weather_location: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
    username: Optional[str] = None


# ============== Dashboard Schemas ==============

class DashboardCreate(BaseModel):
    name: str = Field(default="My Dashboard", max_length=255)
    icon: Optional[str] = Field(None, max_length=10)
    is_default: bool = False


class DashboardUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    icon: Optional[str] = Field(None, max_length=10)
    is_default: Optional[bool] = None
    is_shared: Optional[bool] = None


class DashboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    owner_id: int
    name: str
    icon: Optional[str]
    is_default: bool
    is_shared: bool
    share_token: Optional[str]
    created_at: datetime
    updated_at: datetime


# ============== Widget Schemas ==============

class WidgetCreate(BaseModel):
    dashboard_id: int
    widget_type: str = Field(pattern="^(links|notes|weather|docker|proxmox|search|clock)$")
    title: str = Field(default="Widget", max_length=255)
    grid_x: int = Field(default=0, ge=0)
    grid_y: int = Field(default=0, ge=0)
    grid_w: int = Field(default=4, ge=1, le=12)
    grid_h: int = Field(default=3, ge=1, le=12)
    config: dict = Field(default_factory=dict)


class WidgetUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    grid_x: Optional[int] = Field(None, ge=0)
    grid_y: Optional[int] = Field(None, ge=0)
    grid_w: Optional[int] = Field(None, ge=1, le=12)
    grid_h: Optional[int] = Field(None, ge=1, le=12)
    config: Optional[dict] = None


class WidgetPositionUpdate(BaseModel):
    """For batch position updates after drag/drop."""
    id: int
    grid_x: int = Field(ge=0)
    grid_y: int = Field(ge=0)
    grid_w: int = Field(ge=1, le=12)
    grid_h: int = Field(ge=1, le=12)


class WidgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    dashboard_id: int
    widget_type: str
    title: str
    grid_x: int
    grid_y: int
    grid_w: int
    grid_h: int
    config: dict
    created_at: datetime
    updated_at: datetime


# ============== Link Schemas ==============

class LinkCreate(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    category: str = "uncategorized"
    custom_tags: List[str] = Field(default_factory=list)
    is_pinned: bool = False
    widget_id: Optional[int] = None  # Assign to specific widget
    custom_icon: Optional[str] = None  # Emoji icon or URL


class LinkUpdate(BaseModel):
    url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    custom_tags: Optional[List[str]] = None
    is_pinned: Optional[bool] = None
    display_order: Optional[int] = None
    widget_id: Optional[int] = None
    custom_icon: Optional[str] = None


class LinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    owner_id: int
    widget_id: Optional[int]
    url: str
    title: str
    description: Optional[str]
    favicon_url: Optional[str]
    custom_icon: Optional[str]
    category: str
    is_ai_categorized: bool
    custom_tags: List[str]
    is_pinned: bool
    display_order: int
    last_clicked: Optional[datetime] = None
    click_count: int = 0
    created_at: datetime
    updated_at: datetime


class LinkPreviewResponse(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None



# ============== Note Schemas ==============

class NoteCreate(BaseModel):
    title: str = Field(default="Untitled Note", max_length=255)
    content: str = ""
    is_code: bool = False
    code_language: Optional[str] = None
    category: str = "general"
    color: str = "default"
    is_pinned: bool = False
    tags: List[str] = Field(default_factory=list)
    show_as_widget: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    content: Optional[str] = None
    is_code: Optional[bool] = None
    code_language: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None
    tags: Optional[List[str]] = None
    show_as_widget: Optional[bool] = None
    widget_grid_x: Optional[int] = None
    widget_grid_y: Optional[int] = None
    widget_grid_w: Optional[int] = None
    widget_grid_h: Optional[int] = None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    owner_id: int
    title: str
    content: str
    is_code: bool
    code_language: Optional[str]
    category: str
    is_pinned: bool
    tags: List[str]
    color: str
    show_as_widget: bool
    widget_grid_x: int
    widget_grid_y: int
    widget_grid_w: int
    widget_grid_h: int
    last_viewed: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ============== Integration Schemas ==============

class IntegrationCreate(BaseModel):
    integration_type: str = Field(pattern="^(docker|proxmox)$")
    name: str = Field(max_length=255)
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    token_name: Optional[str] = None
    token_value: Optional[str] = None
    use_tls: bool = True
    verify_ssl: bool = False


class IntegrationUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    token_name: Optional[str] = None
    token_value: Optional[str] = None
    use_tls: Optional[bool] = None
    verify_ssl: Optional[bool] = None
    is_active: Optional[bool] = None


class IntegrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    owner_id: int
    integration_type: str
    name: str
    host: Optional[str]
    port: Optional[int]
    use_tls: bool
    verify_ssl: bool
    is_active: bool
    last_checked: Optional[datetime]
    last_status: Optional[str]
    created_at: datetime
    updated_at: datetime


# ============== Weather Schemas ==============

class WeatherCurrent(BaseModel):
    location: str
    temperature: float
    feels_like: float
    humidity: int
    description: str
    icon: str
    wind_speed: float
    wind_direction: int
    visibility: int
    pressure: int
    sunrise: datetime
    sunset: datetime


class WeatherForecastDay(BaseModel):
    date: datetime
    temp_high: float
    temp_low: float
    description: str
    icon: str
    precipitation_chance: int


class WeatherResponse(BaseModel):
    current: WeatherCurrent
    forecast: List[WeatherForecastDay]


# ============== Docker Schemas ==============

class DockerContainer(BaseModel):
    id: str
    name: str
    image: str
    status: str
    state: str
    created: datetime
    ports: List[dict]
    cpu_percent: Optional[float] = None
    memory_usage: Optional[int] = None
    memory_limit: Optional[int] = None
    memory_percent: Optional[float] = None


class DockerResponse(BaseModel):
    containers: List[DockerContainer]
    total_containers: int
    running_containers: int


# ============== Proxmox Schemas ==============

class ProxmoxVM(BaseModel):
    vmid: int
    name: str
    node: str
    type: str  # qemu or lxc
    status: str
    cpu: float
    maxcpu: int
    mem: int
    maxmem: int
    disk: int
    maxdisk: int
    uptime: Optional[int] = None


class ProxmoxNode(BaseModel):
    node: str
    status: str
    cpu: float
    maxcpu: int
    mem: int
    maxmem: int
    disk: int
    maxdisk: int
    uptime: int


class ProxmoxResponse(BaseModel):
    nodes: List[ProxmoxNode]
    vms: List[ProxmoxVM]


# ============== AI Categorization Schemas ==============


class CategorizeLinkRequest(BaseModel):
    link_ids: List[int] = Field(default_factory=list)
    categorize_all: bool = False


class CategorizeLinkResponse(BaseModel):
    categorized_count: int
    results: List[dict]


class SuggestTagsResponse(BaseModel):
    tags: List[str]

