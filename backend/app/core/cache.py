# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Redis Cache Service for analytics endpoints.

Provides a decorator-based caching pattern using Redis for high-traffic endpoints.
Falls back gracefully when Redis is unavailable.
"""

import hashlib
import json
import logging
from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

import redis.asyncio as redis
from redis.exceptions import ConnectionError, TimeoutError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Type variable for generic return type
T = TypeVar("T")

# Global Redis connection pool (lazy initialization)
_redis_pool: redis.ConnectionPool | None = None


async def get_redis_client() -> redis.Redis | None:
    """
    Get a Redis client from the connection pool.
    Returns None if Redis is unavailable.
    """
    global _redis_pool

    try:
        if _redis_pool is None:
            _redis_pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1.0,
                socket_timeout=1.0,
            )

        client = redis.Redis(connection_pool=_redis_pool)
        # Quick ping to verify connection
        await client.ping()
        return client
    except (ConnectionError, TimeoutError, OSError) as e:
        logger.warning(f"Redis unavailable: {e}. Cache will be bypassed.")
        return None


def _make_cache_key(prefix: str, *args: Any, **kwargs: Any) -> str:
    """
    Generate a deterministic cache key from function arguments.
    """
    key_parts = [prefix]

    # Add positional args
    for arg in args:
        if hasattr(arg, "__dict__"):
            # Skip non-serializable objects (like db sessions)
            continue
        key_parts.append(str(arg))

    # Add keyword args (sorted for consistency)
    for k, v in sorted(kwargs.items()):
        if hasattr(v, "__dict__"):
            continue
        key_parts.append(f"{k}={v}")

    # Create a hash for long keys
    key_string = ":".join(key_parts)
    if len(key_string) > 200:
        key_hash = hashlib.md5(key_string.encode()).hexdigest()[:16]
        return f"{prefix}:{key_hash}"

    return key_string


def cached(ttl: int = settings.CACHE_DEFAULT_TTL, prefix: str | None = None):
    """
    Decorator to cache async function results in Redis.

    Usage:
        @cached(ttl=60)
        async def get_stats(db, line_id: str):
            ...

    Args:
        ttl: Time-to-live in seconds (default: 60)
        prefix: Optional key prefix (defaults to function name)
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            cache_prefix = prefix or f"cache:{func.__module__}.{func.__name__}"
            cache_key = _make_cache_key(cache_prefix, *args, **kwargs)

            # Try to get from cache
            client = await get_redis_client()
            if client:
                try:
                    cached_value = await client.get(cache_key)
                    if cached_value is not None:
                        logger.debug(f"Cache HIT: {cache_key}")
                        return json.loads(cached_value)
                except Exception as e:
                    logger.warning(f"Cache read error: {e}")

            # Cache miss - execute function
            logger.debug(f"Cache MISS: {cache_key}")
            result = await func(*args, **kwargs)

            # Store in cache
            if client and result is not None:
                try:
                    await client.setex(cache_key, ttl, json.dumps(result, default=str))
                except Exception as e:
                    logger.warning(f"Cache write error: {e}")

            return result

        return wrapper

    return decorator


async def invalidate_cache(pattern: str = "cache:*") -> int:
    """
    Invalidate cache keys matching a pattern.

    Args:
        pattern: Redis key pattern to match (supports * wildcard)

    Returns:
        Number of keys deleted
    """
    client = await get_redis_client()
    if not client:
        return 0

    try:
        keys = await client.keys(pattern)
        if keys:
            deleted = await client.delete(*keys)
            logger.info(f"Invalidated {deleted} cache keys matching '{pattern}'")
            return deleted
        return 0
    except Exception as e:
        logger.warning(f"Cache invalidation error: {e}")
        return 0


async def invalidate_analytics_cache() -> int:
    """
    Invalidate all analytics cache entries.
    Called after data promotion to ensure fresh data.
    """
    return await invalidate_cache("cache:app.api.v1.endpoints.analytics*")
