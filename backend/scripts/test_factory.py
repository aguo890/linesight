
import sys
import os
import logging

# Add backend to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.factory import get_etl_agent, get_widget_suggestion_service
from app.core.interfaces import ETLAgentInterface, WidgetSuggestionInterface

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_factory():
    logger.info("Testing Factory Pattern...")

    # Test ETL Agent
    logger.info("1. Requesting ETL Agent...")
    etl_agent = get_etl_agent()
    logger.info(f"   Got: {type(etl_agent)}")
    assert isinstance(etl_agent, ETLAgentInterface)
    
    if "private_core" in str(type(etl_agent)):
        logger.info("   ✅ Correctly loaded Private ETL Agent")
    elif "public_core" in str(type(etl_agent)):
         logger.info("   ⚠️ Loaded Public ETL Agent (Mock)")
    else:
        logger.error(f"   ❌ Unknown agent type: {type(etl_agent)}")

    # Test Widget Suggestion Service
    logger.info("2. Requesting Widget Suggestion Service...")
    widget_service = get_widget_suggestion_service()
    logger.info(f"   Got: {type(widget_service)}")
    # Widget service might be a module or class instance depending on implementation
    # defined in factory.py
    
    # In factory.py: return widget_suggestion_service (which is an instance)
    
    if "private_core" in str(type(widget_service)) or "private_core" in str(widget_service):
        logger.info("   ✅ Correctly loaded Private Widget Service")
    elif "public_core" in str(type(widget_service)) or "public_core" in str(widget_service):
         logger.info("   ⚠️ Loaded Public Widget Service (Mock)")
    else:
         logger.error(f"   ❌ Unknown service type: {type(widget_service)}")

if __name__ == "__main__":
    test_factory()
