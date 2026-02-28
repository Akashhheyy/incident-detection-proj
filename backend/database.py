import os
from functools import lru_cache
from typing import Any, Dict

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection


# ✅ Load environment variables from .env file
load_dotenv()


MONGODB_URI_ENV = "MONGODB_URI"
DEFAULT_DB_NAME = "camera_incident_db"
ALERTS_COLLECTION_NAME = "alerts"


class MongoConnectionError(Exception):
    """Raised when MongoDB connection cannot be established."""
    pass


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    """Return a cached MongoClient instance."""
    uri = os.getenv(MONGODB_URI_ENV)

    if not uri:
        raise MongoConnectionError(
            f"Environment variable {MONGODB_URI_ENV} is not set. "
            "Make sure your .env file contains MONGODB_URI."
        )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000)

    # ✅ Test connection immediately
    try:
        client.admin.command("ping")
        print("✅ Connected to MongoDB successfully.")
    except Exception as exc:
        raise MongoConnectionError(
            f"❌ Failed to connect to MongoDB: {exc}"
        ) from exc

    return client


def get_database_name() -> str:
    """Return the database name (can override via MONGODB_DB_NAME in .env)."""
    return os.getenv("MONGODB_DB_NAME", DEFAULT_DB_NAME)


def get_alerts_collection() -> Collection[Dict[str, Any]]:
    """Return the alerts collection handle."""
    client = get_mongo_client()
    db = client[get_database_name()]
    return db[ALERTS_COLLECTION_NAME]


def close_mongo_client() -> None:
    """Close the cached Mongo client if it exists."""
    try:
        client = get_mongo_client()
        client.close()
        print("🔒 MongoDB connection closed.")
    except MongoConnectionError:
        pass