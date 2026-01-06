"""
Compliance and traceability models.
TraceabilityRecord for UFLPA and EU Digital Product Passport compliance.
"""

from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.cutting import CutTicket, FabricLot
    from app.models.shipping import Carton
    from app.models.user import User


class ComplianceStandard(str, PyEnum):
    """Compliance standards supported."""

    UFLPA = "uflpa"  # Uyghur Forced Labor Prevention Act
    EU_DPP = "eu_dpp"  # EU Digital Product Passport
    CA_SB657 = "ca_sb657"  # California Transparency in Supply Chains Act
    UK_MSA = "uk_msa"  # UK Modern Slavery Act
    OTHER = "other"


class VerificationStatus(str, PyEnum):
    """Verification status of traceability record."""

    PENDING = "pending"
    VERIFIED = "verified"
    FLAGGED = "flagged"
    REJECTED = "rejected"


class TraceabilityRecord(Base, UUIDMixin, TimestampMixin):
    """
    Chain of custody record for compliance.
    Links finished goods back through the entire supply chain.
    Critical for UFLPA and EU Digital Product Passport requirements.
    """

    __tablename__ = "traceability_records"

    # Link to shipped goods
    carton_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("cartons.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Link to fabric source
    fabric_lot_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("fabric_lots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Link to cutting
    cut_ticket_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("cut_tickets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Link to production
    production_run_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("production_runs.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Compliance Standard
    compliance_standard: Mapped[ComplianceStandard] = mapped_column(
        Enum(ComplianceStandard),
        default=ComplianceStandard.UFLPA,
        nullable=False,
    )

    # Chain of Custody (Full JSON traceability)
    chain_of_custody: Mapped[str | None] = mapped_column(Text, nullable=True)
    """
    JSON structure example:
    {
        "cotton": {"origin": "USA", "farm": "Texas Cotton Co", "cert": "BCI-12345"},
        "yarn": {"mill": "Yarn Mills Inc", "country": "India"},
        "fabric": {"mill": "Premium Textiles", "country": "Vietnam", "lot": "FL-2025-001"},
        "cut": {"factory": "Factory A", "date": "2025-01-15", "ticket": "CT-001"},
        "sew": {"factory": "Factory A", "line": "Line 5", "date": "2025-01-20"},
        "pack": {"factory": "Factory A", "date": "2025-01-25", "carton": "CTN-001"}
    }
    """

    # Supporting Documents (URLs/paths)
    supporting_documents: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )  # JSON array of URLs

    # Verification
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus),
        default=VerificationStatus.PENDING,
        nullable=False,
    )

    # Verified By
    verified_by_id: Mapped[str | None] = mapped_column(
        CHAR(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Risk Assessment
    risk_score: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # e.g., 'low', 'medium', 'high'
    risk_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    carton: Mapped[Optional["Carton"]] = relationship(
        "Carton",
        back_populates="traceability_records",
    )
    fabric_lot: Mapped[Optional["FabricLot"]] = relationship(
        "FabricLot",
        back_populates="traceability_records",
    )
    cut_ticket: Mapped[Optional["CutTicket"]] = relationship(
        "CutTicket",
        back_populates="traceability_records",
    )
    verified_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[verified_by_id],
    )

    def __repr__(self) -> str:
        return (
            f"<TraceabilityRecord(id={self.id}, standard={self.compliance_standard})>"
        )
