"""
Tests for Excel Parser service.
"""

from app.services.excel_parser import ColumnMatchConfidence, FlexibleExcelParser


class TestFlexibleExcelParser:
    """Test the FlexibleExcelParser service."""

    def test_fuzzy_column_matching_qty(self):
        """Test that 'Qty' maps to 'quantity'."""
        parser = FlexibleExcelParser()
        mappings = parser._map_columns(["Qty", "Style", "Color"])

        # Find the qty mapping
        qty_mapping = next((m for m in mappings if m.source_column == "Qty"), None)
        assert qty_mapping is not None
        assert qty_mapping.target_field == "quantity"
        assert qty_mapping.confidence in [
            ColumnMatchConfidence.EXACT,
            ColumnMatchConfidence.FUZZY,
        ]

    def test_fuzzy_column_matching_po(self):
        """Test that 'PO#' maps to 'po_number'."""
        parser = FlexibleExcelParser()
        mappings = parser._map_columns(["PO#", "Ship Date"])

        po_mapping = next((m for m in mappings if m.source_column == "PO#"), None)
        assert po_mapping is not None
        assert po_mapping.target_field == "po_number"

    def test_header_scoring(self):
        """Test header row detection scoring."""
        parser = FlexibleExcelParser()

        # Good header row
        headers = ["Style", "Qty", "Color", "Size"]
        score = parser._score_header_row(headers)
        assert score > 0

        # Bad header row (looks like data)
        data_row = ["12345", "100", "Blue", "M"]
        data_score = parser._score_header_row(data_row)

        # Headers should score higher than data
        assert score > data_score

    def test_clean_column_name(self):
        """Test column name normalization."""
        parser = FlexibleExcelParser()

        assert parser._clean_column_name("  Qty  ") == "Qty"
        assert parser._clean_column_name("Unnamed: 0") == ""

    def test_empty_columns_filtered(self):
        """Test that empty column names are filtered."""
        parser = FlexibleExcelParser()
        mappings = parser._map_columns(["", "Qty", "  ", "Color"])

        source_columns = [m.source_column for m in mappings]
        assert "" not in source_columns
        assert "Qty" in source_columns
        assert "Color" in source_columns
