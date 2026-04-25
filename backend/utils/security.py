"""
Security utilities for Tactix backend.

Includes API key authentication, safe model loading with integrity checks,
input validation helpers, and security header configuration.
"""
from __future__ import annotations

import functools
import hashlib
import logging
import os
import re
from pathlib import Path
from typing import Callable

from flask import Flask, current_app, jsonify, request

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API Key Authentication
# ---------------------------------------------------------------------------

def require_api_key(func: Callable) -> Callable:
    """Decorator that requires a valid X-API-Key header when TACTIX_API_KEY is set."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        expected_key = current_app.config.get("TACTIX_API_KEY")
        # If no API key is configured, skip authentication (local dev fallback)
        if not expected_key:
            return func(*args, **kwargs)

        provided_key = request.headers.get("X-API-Key")
        if not provided_key:
            return jsonify({"error": "Unauthorized: X-API-Key header required"}), 401
        if provided_key != expected_key:
            return jsonify({"error": "Unauthorized: Invalid API key"}), 401

        return func(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# Safe Joblib Model Loading
# ---------------------------------------------------------------------------

def _read_hash_file(path: str) -> str | None:
    """Read SHA-256 hash from sidecar file if it exists."""
    hash_path = f"{path}.sha256"
    if not os.path.exists(hash_path):
        return None
    try:
        with open(hash_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return None


def _compute_file_hash(path: str) -> str:
    """Compute SHA-256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def secure_joblib_load(path: str, loader: Callable):
    """
    Load a joblib model file with optional SHA-256 integrity verification.

    Args:
        path: Path to the .joblib file.
        loader: Callable that performs the actual joblib.load(path).

    Returns:
        The loaded model data, or None if integrity check fails.
    """
    if not os.path.exists(path):
        return None

    expected_hash = _read_hash_file(path)
    if expected_hash is not None:
        actual_hash = _compute_file_hash(path)
        if actual_hash != expected_hash:
            logger.error(
                "Model integrity check failed for %s: expected %s, got %s",
                path,
                expected_hash,
                actual_hash,
            )
            return None

    return loader(path)


def write_model_hash(path: str) -> str:
    """Compute and write SHA-256 sidecar file for a model."""
    file_hash = _compute_file_hash(path)
    hash_path = f"{path}.sha256"
    with open(hash_path, "w", encoding="utf-8") as f:
        f.write(file_hash)
    return file_hash


# ---------------------------------------------------------------------------
# Input Validation Helpers
# ---------------------------------------------------------------------------

SAFE_IDENTIFIER_RE = re.compile(r"^[a-zA-Z0-9_]+$")
SAFE_BRANCH_RE = re.compile(r"^[a-zA-Z0-9._/-]+$")


def is_safe_identifier(value: str) -> bool:
    """Return True if value is a safe SQL identifier (alphanumeric + underscore)."""
    return bool(SAFE_IDENTIFIER_RE.match(value))


def sanitize_path_component(value: str) -> str:
    """Remove path traversal characters from a path component."""
    return re.sub(r"[^a-zA-Z0-9_-]", "", str(value))


def validate_path_within_base(resolved_path: Path, base_dir: Path) -> bool:
    """Ensure resolved_path is within base_dir (prevents path traversal)."""
    try:
        resolved_path.resolve().relative_to(base_dir.resolve())
        return True
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Security Headers
# ---------------------------------------------------------------------------

def add_security_headers(response):
    """Add security headers to a Flask response object."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # CSP in report-only mode initially to avoid breaking things
    response.headers[
        "Content-Security-Policy-Report-Only"
    ] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self'; "
        "img-src 'self' data:;"
    )

    # HSTS only in production / when not on localhost
    if not current_app.debug:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )

    return response


# ---------------------------------------------------------------------------
# Generic Error Response
# ---------------------------------------------------------------------------

def generic_error_response(message: str = "Internal server error", status_code: int = 500):
    """Return a sanitized JSON error response."""
    return jsonify({"error": message}), status_code
