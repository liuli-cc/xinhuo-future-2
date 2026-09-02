"""
Role-based permission checks.

Mirrors the permission model from the existing CloudBase backend:
  - student: basic access to own data
  - teacher / counselor: can manage students in same college + class
  - college_admin: can manage students in same college
  - school_admin / admin: full access
"""

from __future__ import annotations

from enum import Enum
from typing import Any


class Role(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    COUNSELOR = "counselor"
    COLLEGE_ADMIN = "college_admin"
    SCHOOL_ADMIN = "school_admin"
    ADMIN = "admin"


ROLES = set(Role)

STAFF_ROLES = {Role.TEACHER, Role.COUNSELOR, Role.COLLEGE_ADMIN, Role.SCHOOL_ADMIN, Role.ADMIN}
MANAGEMENT_ROLES = {Role.COLLEGE_ADMIN, Role.SCHOOL_ADMIN, Role.ADMIN}
SYSTEM_ROLES = {Role.SCHOOL_ADMIN, Role.ADMIN}
REVIEW_ROLES = STAFF_ROLES  # Anyone who is not a student can review


def is_staff(user: dict | Any) -> bool:
    """Check if user is staff (non-student)."""
    role = _get_role(user)
    return role in STAFF_ROLES


def can_review_evidence(user: dict | Any) -> bool:
    """Check if user can review evidence."""
    return is_staff(user)


def can_manage_accounts(user: dict | Any) -> bool:
    """Check if user can manage other accounts."""
    role = _get_role(user)
    return role in MANAGEMENT_ROLES


def can_manage_system(user: dict | Any) -> bool:
    """Check if user can manage system-level settings."""
    role = _get_role(user)
    return role in SYSTEM_ROLES


def can_access_target(
    actor: dict | Any,
    target: dict | Any,
) -> bool:
    """Check if actor can access target user's data.

    Rules:
    - Users can access their own data
    - school_admin / admin can access anyone
    - college_admin can access same-college users
    - teacher / counselor can access same-college + same-class users
    """
    if not actor or not target:
        return False

    actor_id = _get_id(actor)
    target_id = _get_id(target)
    if actor_id == target_id:
        return True

    role = _get_role(actor)
    if role in SYSTEM_ROLES:
        return True
    if role == Role.COLLEGE_ADMIN:
        return _get_college(actor) == _get_college(target)
    if role in (Role.TEACHER, Role.COUNSELOR):
        return (
            _get_college(actor) == _get_college(target)
            and bool(_get_class_name(actor))
            and _get_class_name(actor) == _get_class_name(target)
        )
    return False


def _get_role(user: dict | Any) -> str:
    if isinstance(user, dict):
        return user.get("role", "")
    return getattr(user, "role", "")


def _get_id(user: dict | Any) -> int | None:
    if isinstance(user, dict):
        return user.get("id")
    return getattr(user, "id", None)


def _get_college(user: dict | Any) -> str:
    if isinstance(user, dict):
        return user.get("college", "")
    return getattr(user, "college", "")


def _get_class_name(user: dict | Any) -> str:
    if isinstance(user, dict):
        return user.get("class_name", user.get("className", ""))
    return getattr(user, "class_name", getattr(user, "className", ""))
