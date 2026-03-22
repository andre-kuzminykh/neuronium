import difflib


def compute_unified_diff(original: str, modified: str, file_path: str = "") -> str:
    """Compute a unified diff between original and modified text."""
    original_lines = original.splitlines(keepends=True)
    modified_lines = modified.splitlines(keepends=True)
    diff = difflib.unified_diff(
        original_lines,
        modified_lines,
        fromfile=f"a/{file_path}",
        tofile=f"b/{file_path}",
        lineterm="",
    )
    return "".join(diff)


def apply_diff_to_selection(original_full: str, start: int, end: int, replacement: str) -> str:
    """Replace a selection range in the original text."""
    return original_full[:start] + replacement + original_full[end:]
