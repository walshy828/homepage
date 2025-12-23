"""
Homepage Dashboard - Database Models
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text, Boolean, Integer, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    """User model for authentication and dashboard ownership."""
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Preferences
    theme: Mapped[str] = mapped_column(String(20), default="system")  # light, dark, system
    default_weather_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Relationships
    dashboards: Mapped[List["Dashboard"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    notes: Mapped[List["Note"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    links: Mapped[List["Link"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Dashboard(Base):
    """Dashboard containing widgets and their layout."""
    __tablename__ = "dashboards"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255), default="My Dashboard")
    icon: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # Emoji icon
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    share_token: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner: Mapped["User"] = relationship(back_populates="dashboards")
    widgets: Mapped[List["Widget"]] = relationship(back_populates="dashboard", cascade="all, delete-orphan")


class Widget(Base):
    """Widget instance on a dashboard with position and configuration."""
    __tablename__ = "widgets"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    dashboard_id: Mapped[int] = mapped_column(ForeignKey("dashboards.id"))
    widget_type: Mapped[str] = mapped_column(String(50))  # links, notes, weather, docker, proxmox, search
    title: Mapped[str] = mapped_column(String(255), default="Widget")
    
    # Gridstack position
    grid_x: Mapped[int] = mapped_column(Integer, default=0)
    grid_y: Mapped[int] = mapped_column(Integer, default=0)
    grid_w: Mapped[int] = mapped_column(Integer, default=4)
    grid_h: Mapped[int] = mapped_column(Integer, default=3)
    
    # Widget-specific configuration (JSON)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    dashboard: Mapped["Dashboard"] = relationship(back_populates="widgets")


class Link(Base):
    """Bookmark/link with optional AI categorization."""
    __tablename__ = "links"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    widget_id: Mapped[Optional[int]] = mapped_column(ForeignKey("widgets.id"), nullable=True)  # Assigned to specific widget
    url: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    favicon_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_icon: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Emoji icon or URL for internal links
    
    # Categorization
    category: Mapped[str] = mapped_column(String(50), default="uncategorized")
    is_ai_categorized: Mapped[bool] = mapped_column(Boolean, default=False)
    custom_tags: Mapped[list] = mapped_column(JSON, default=list)
    
    # Display order and pinning
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Recent tracking
    last_clicked: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    click_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner: Mapped["User"] = relationship(back_populates="links")


class Note(Base):
    """Note with optional code formatting support."""
    __tablename__ = "notes"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255), default="Untitled Note")
    content: Mapped[str] = mapped_column(Text, default="")
    
    # Code snippet settings
    is_code: Mapped[bool] = mapped_column(Boolean, default=False)
    code_language: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Organization
    category: Mapped[str] = mapped_column(String(50), default="general")
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    color: Mapped[str] = mapped_column(String(20), default="default")
    
    # Widget display
    show_as_widget: Mapped[bool] = mapped_column(Boolean, default=False)  # Show on dashboard
    widget_grid_x: Mapped[int] = mapped_column(Integer, default=0)
    widget_grid_y: Mapped[int] = mapped_column(Integer, default=0)
    widget_grid_w: Mapped[int] = mapped_column(Integer, default=3)
    widget_grid_h: Mapped[int] = mapped_column(Integer, default=2)
    
    # Tags
    tags: Mapped[list] = mapped_column(JSON, default=list)
    
    # Recent tracking
    last_viewed: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    owner: Mapped["User"] = relationship(back_populates="notes")


class Integration(Base):
    """Integration configuration for Docker/Proxmox connections."""
    __tablename__ = "integrations"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    integration_type: Mapped[str] = mapped_column(String(50))  # docker, proxmox
    name: Mapped[str] = mapped_column(String(255))
    
    # Connection settings (encrypted in production)
    host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    token_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    token_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    verify_ssl: Mapped[bool] = mapped_column(Boolean, default=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
