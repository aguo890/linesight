# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Sample data API endpoints.
Provides access to test Excel files for frontend development and testing.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter()

# Path to sample data directory
# From: backend/app/api/v1/endpoints/samples.py
# To:   backend/tests/data
SAMPLE_DATA_DIR = Path(__file__).parent.parent.parent.parent.parent / "tests" / "data"


class SampleFile(BaseModel):
    filename: str
    size: int
    description: str


@router.get("/sample-files", response_model=list[SampleFile])
async def list_sample_files():
    """List available sample Excel files for testing."""

    import logging

    logger = logging.getLogger(__name__)

    logger.info(f"Sample data directory: {SAMPLE_DATA_DIR}")
    logger.info(f"Directory exists: {SAMPLE_DATA_DIR.exists()}")

    if not SAMPLE_DATA_DIR.exists():
        logger.warning(f"Sample data directory does not exist: {SAMPLE_DATA_DIR}")
        return []

    sample_files = []

    # Define sample files with descriptions
    file_descriptions = {
        "perfect_production.xlsx": "Clean production data with standard formatting",
        "messy_production.xlsx": "Production data with inconsistent formatting and missing values",
        "ambiguous_production.xlsx": "Production data with ambiguous column names requiring AI interpretation",
    }

    # List all files in directory
    all_files = list(SAMPLE_DATA_DIR.glob("*"))
    logger.info(f"All files in directory: {all_files}")

    for file_path in SAMPLE_DATA_DIR.glob("*.xlsx"):
        logger.info(f"Found xlsx file: {file_path}")
        if file_path.is_file():
            sample_files.append(
                SampleFile(
                    filename=file_path.name,
                    size=file_path.stat().st_size,
                    description=file_descriptions.get(
                        file_path.name, "Sample production data"
                    ),
                )
            )

    # Also include CSV files
    for file_path in SAMPLE_DATA_DIR.glob("*.csv"):
        logger.info(f"Found csv file: {file_path}")
        if file_path.is_file():
            sample_files.append(
                SampleFile(
                    filename=file_path.name,
                    size=file_path.stat().st_size,
                    description=file_descriptions.get(
                        file_path.name, "Sample production data (CSV)"
                    ),
                )
            )

    logger.info(f"Returning {len(sample_files)} sample files")
    return sample_files


@router.get("/sample-files/{filename}")
async def download_sample_file(filename: str):
    """Download a specific sample file."""

    # Security: prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = SAMPLE_DATA_DIR / filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Sample file not found")

    # Determine media type
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if filename.endswith(".csv"):
        media_type = "text/csv"
    elif filename.endswith(".xls"):
        media_type = "application/vnd.ms-excel"

    return FileResponse(path=str(file_path), media_type=media_type, filename=filename)
