"""
Tier 1: Hash/Alias Matcher.

Provides instant O(1) lookups for known column aliases.
This is the fastest tier - no computation needed.

Algorithm:
1. Normalize input (lowercase, strip, replace spaces/hyphens with underscores)
2. Check factory-scoped aliases first (highest priority)
3. Check organization-scoped aliases
4. Check global aliases
5. Check built-in canonical aliases

Performance: <1ms per lookup
"""

from typing import Any

from sqlalchemy.orm import Session

from app.services.matching.types import MatchResult, MatchTier


class HashAliasMatcher:
    """
    Tier 1: Deterministic alias matching via hash lookup.

    Features:
    - Built-in canonical aliases for common variations
    - Factory-scoped learned aliases (from user corrections)
    - Organization-scoped aliases
    - Global aliases (promoted from high-usage)
    """

    # Built-in canonical aliases (ODSAS-aligned)
    # Maps messy variations → canonical field name
    CANONICAL_ALIASES: dict[str, str] = {
        # SAM variations
        "sam": "sam",
        "smv": "sam",
        "standard_allowed_minute": "sam",
        "standard_minute": "sam",
        "sewing_time": "sam",
        "operation_time": "sam",
        "allowed_time": "sam",
        # DHU variations
        "dhu": "dhu",
        "defects_per_hundred": "dhu",
        "defect_rate": "dhu",
        "fail_rate": "dhu",
        "rejection_rate": "dhu",
        # Efficiency variations
        "line_efficiency": "line_efficiency",
        "efficiency": "line_efficiency",
        "eff": "line_efficiency",
        "eff_pct": "line_efficiency",
        "efficiency_pct": "line_efficiency",
        "performance": "line_efficiency",
        # Production count variations
        "actual_qty": "actual_qty",
        "production_count": "actual_qty",
        "output": "actual_qty",
        "pieces": "actual_qty",
        "pcs": "actual_qty",
        "units": "actual_qty",
        "qty": "actual_qty",
        "quantity": "actual_qty",
        "produced": "actual_qty",
        "actual_output": "actual_qty",
        "produced_qty": "actual_qty",
        # Target variations
        "planned_qty": "planned_qty",
        "target": "planned_qty",
        "target_qty": "planned_qty",
        "target_output": "planned_qty",
        "daily_target": "planned_qty",
        "target_quantity": "planned_qty",
        # Quality (Defects)
        "defects": "defects",
        "defect_count": "defects",
        "total_defects": "defects",
        "no_of_defects": "defects",
        "rejects": "defects",
        "rejected": "defects",
        # workforce
        "operators": "operators_present",
        "operator": "operators_present",
        "operators_present": "operators_present",
        "operator_present": "operators_present",
        "helpers": "helpers_present",
        "helper": "helpers_present",
        "helpers_present": "helpers_present",
        "manpower": "total_manpower",
        "total_manpower": "total_manpower",
        "worker_count": "operators_present",
        # Date variations
        "production_date": "production_date",
        "date": "production_date",
        "prod_date": "production_date",
        "work_date": "production_date",
        "shift_date": "production_date",
        # Identifiers
        "style_number": "style_number",
        "style": "style_number",
        "style_code": "style_number",
        "style_no": "style_number",
        "sku": "style_number",
        "po_number": "po_number",
        "po": "po_number",
        "order_id": "order_id",
        "line_name": "line_name",
        "line_id": "line_id",
        "lot_number": "lot_number",
        "batch_number": "batch_number",
        # Product attributes
        "color": "color",
        "colour": "color",
        "buyer": "buyer",
        "buyer_name": "buyer",
        "customer": "buyer",
        "brand": "buyer",
        "season": "season",
        "delivery_date": "delivery_date",
        "ship_date": "delivery_date",
        # Generic
        "notes": "notes",
        "remarks": "notes",
        "comments": "notes",
    }

    def __init__(self, db_session: Session | None = None):
        """
        Initialize the matcher.

        Args:
            db_session: Optional database session (sync or async) for loading learned aliases
        """
        self.db_session = db_session
        self._factory_aliases: dict[
            str, dict[str, str]
        ] = {}  # factory_id -> {alias -> canonical}
        self._org_aliases: dict[
            str, dict[str, str]
        ] = {}  # org_id -> {alias -> canonical}
        self._global_aliases: dict[str, str] = {}  # alias -> canonical

        # If a sync session is provided, we can try to load aliases synchronously (legacy support)
        # But for async sessions, we must call load_aliases() explicitly
        from sqlalchemy.ext.asyncio import AsyncSession

        if db_session and not isinstance(db_session, AsyncSession):
            self._load_learned_aliases_sync()

    async def load_aliases(self) -> None:
        """Load learned aliases from database asynchronously."""
        if not self.db_session:
            return

        try:
            from sqlalchemy import select

            from app.models.alias_mapping import AliasMapping

            # Load all active aliases
            result = await self.db_session.execute(  # type: ignore[misc]
                select(AliasMapping).where(AliasMapping.is_active)
            )
            aliases = result.scalars().all()
            self._process_loaded_aliases(aliases)

        except Exception as e:
            # Don't fail if alias loading fails
            print(f"Warning: Failed to load learned aliases (async): {e}")

    def _load_learned_aliases_sync(self) -> None:
        """Load learned aliases from database synchronously (legacy)."""
        if not self.db_session:
            return

        try:
            from app.models.alias_mapping import AliasMapping

            # Load all active aliases
            aliases = (
                self.db_session.query(AliasMapping).filter(AliasMapping.is_active).all()
            )
            self._process_loaded_aliases(aliases)

        except Exception as e:
            print(f"Warning: Failed to load learned aliases (sync): {e}")

    def _process_loaded_aliases(self, aliases: list[Any]) -> None:
        """Process loaded aliases into memory structures."""
        from app.models.alias_mapping import AliasScope

        for alias in aliases:
            normalized = alias.source_alias_normalized
            canonical = alias.canonical_field

            if alias.scope == AliasScope.FACTORY.value and alias.factory_id:
                if alias.factory_id not in self._factory_aliases:
                    self._factory_aliases[alias.factory_id] = {}
                self._factory_aliases[alias.factory_id][normalized] = canonical

            elif alias.scope == AliasScope.ORGANIZATION.value and alias.organization_id:
                if alias.organization_id not in self._org_aliases:
                    self._org_aliases[alias.organization_id] = {}
                self._org_aliases[alias.organization_id][normalized] = canonical

            elif alias.scope == AliasScope.GLOBAL.value:
                self._global_aliases[normalized] = canonical

    @staticmethod
    def normalize(column_name: str) -> str:
        """
        Normalize a column name for matching.

        Transformations:
        - Lowercase
        - Strip whitespace
        - Replace common separators (space, hyphen, slash) with underscores
        - Remove common noise characters (dot, parens)
        - Standardize symbols (% to _pct)
        - Deduplicate underscores and strip them from ends
        """
        if not column_name:
            return ""

        normalized = column_name.lower().strip()
        # Replace common separators with underscores
        normalized = normalized.replace(" ", "_").replace("-", "_").replace("/", "_")
        # Remove noise
        normalized = normalized.replace(".", "").replace("(", "").replace(")", "")
        # Standardize symbols
        normalized = normalized.replace("%", "_pct")

        # Remove consecutive underscores and clean edges
        import re

        normalized = re.sub(r"_+", "_", normalized)
        return normalized.strip("_")

    def match(
        self,
        column_name: str,
        factory_id: str | None = None,
        org_id: str | None = None,
    ) -> MatchResult | None:
        """
        Attempt exact hash match.

        Args:
            column_name: Raw column name from file
            factory_id: Optional factory ID for scoped lookup
            org_id: Optional organization ID for scoped lookup

        Returns:
            MatchResult if found, None otherwise
        """
        normalized = self.normalize(column_name)
        if not normalized:
            return None

        # Priority 1: Factory-scoped aliases
        if (
            factory_id
            and factory_id in self._factory_aliases
            and normalized in self._factory_aliases[factory_id]
        ):
            return MatchResult(
                canonical=self._factory_aliases[factory_id][normalized],
                confidence=1.0,
                tier=MatchTier.HASH,
                reasoning="Matched via factory-specific alias",
                fuzzy_score=None,
            )

        # Priority 2: Organization-scoped aliases
        if (
            org_id
            and org_id in self._org_aliases
            and normalized in self._org_aliases[org_id]
        ):
            return MatchResult(
                canonical=self._org_aliases[org_id][normalized],
                confidence=0.99,  # Slightly lower than factory
                tier=MatchTier.HASH,
                reasoning="Matched via organization alias",
                fuzzy_score=None,
            )

        # Priority 3: Global learned aliases
        if normalized in self._global_aliases:
            return MatchResult(
                canonical=self._global_aliases[normalized],
                confidence=0.98,
                tier=MatchTier.HASH,
                reasoning="Matched via global learned alias",
                fuzzy_score=None,
            )

        # Priority 4: Built-in canonical aliases
        if normalized in self.CANONICAL_ALIASES:
            return MatchResult(
                canonical=self.CANONICAL_ALIASES[normalized],
                confidence=1.0,
                tier=MatchTier.HASH,
                reasoning="Matched via built-in alias",
                fuzzy_score=None,
            )

        return None

    def get_all_known_aliases(self) -> list[str]:
        """Get all known aliases (for debugging/introspection)."""
        aliases = set(self.CANONICAL_ALIASES.keys())
        aliases.update(self._global_aliases.keys())
        for factory_aliases in self._factory_aliases.values():
            aliases.update(factory_aliases.keys())
        for org_aliases in self._org_aliases.values():
            aliases.update(org_aliases.keys())
        return sorted(aliases)
