"""
Dashboard models for user-created custom dashboards.
Links data sources to widget configurations and layouts.
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.datasource import DataSource
    from app.models.user import User


class Dashboard(Base, UUIDMixin, TimestampMixin):
    """
    User-created dashboard with widget configuration and layout.
    Links to a data source (ExcelUpload) and stores widget settings.

    Example widget_config:
    {
        "enabled_widgets": ["line_efficiency", "dhu_chart", "timeline"],
        "widget_settings": {
            "line_efficiency": {"threshold": 85},
            "dhu_chart": {"max_value": 10}
        }
    }

    Example layout_config:
    {
        "layouts": [
            {"widget_id": "line_efficiency", "x": 0, "y": 0, "w": 2, "h": 1},
            {"widget_id": "dhu_chart", "x": 2, "y": 0, "w": 2, "h": 2}
        ]
    }
    """

    __tablename__ = "dashboards"

    # User FK (owner of the dashboard)
    user_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey(
            "users.id", ondelete="CASCADE", use_alter=True, name="fk_dashboard_user"
        ),
        nullable=False,
        index=True,
    )

    # Dashboard Metadata
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Data Source FK (optional - can create dashboard without data initially)
    # Links to the DataSource (live configuration) rather than a specific upload
    data_source_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey(
            "data_sources.id",
            ondelete="SET NULL",
            use_alter=True,
            name="fk_dashboard_datasource",
        ),
        nullable=True,
        index=True,
    )

    # Widget Configuration (stored as JSON string)
    # Contains which widgets are enabled and their individual settings
    widget_config: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Layout Configuration (stored as JSON string)
    # Contains grid positions and sizes for each widget
    layout_config: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="dashboards",
    )
    data_source: Mapped["DataSource"] = relationship(
        "DataSource",
        back_populates="dashboards",
    )

    def __repr__(self) -> str:
        return f"<Dashboard(id={self.id}, name={self.name}, user_id={self.user_id})>"
