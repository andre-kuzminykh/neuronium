from pathlib import Path


def resolve_safe_path(base: Path, relative: str) -> Path:
    """Resolve a path ensuring it stays within the base directory."""
    base = base.resolve()
    target = (base / relative).resolve()
    if not str(target).startswith(str(base)):
        raise PermissionError(f"Path traversal detected: {relative}")
    return target


def is_within(base: Path, target: Path) -> bool:
    """Check if target is within base directory."""
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False
