"""
Unit tests for utility modules.
Covers: path_security, file_types, diff_utils.
"""
from __future__ import annotations

import tempfile
import pytest
from pathlib import Path

from backend.utils.path_security import resolve_safe_path, is_within
from backend.utils.file_types import is_text_file, is_binary_file, get_language, TEXT_EXTENSIONS
from backend.utils.diff_utils import compute_unified_diff, apply_diff_to_selection


# ─── path_security ────────────────────────────────────────────────────────────

class TestPathSecurity:
    """FR: backend must prevent path traversal outside workspace."""

    def test_resolve_valid_path(self, tmp_path):
        result = resolve_safe_path(tmp_path, "subdir/file.txt")
        assert str(result).startswith(str(tmp_path))

    def test_resolve_path_traversal_raises(self, tmp_path):
        """NFR-SEC-01: Path traversal must be blocked."""
        with pytest.raises(PermissionError):
            resolve_safe_path(tmp_path, "../../etc/passwd")

    def test_resolve_double_dot_raises(self, tmp_path):
        with pytest.raises(PermissionError):
            resolve_safe_path(tmp_path, "../secret.txt")

    def test_resolve_absolute_outside_raises(self, tmp_path):
        with pytest.raises(PermissionError):
            resolve_safe_path(tmp_path, "/etc/passwd")

    def test_resolve_nested_valid(self, tmp_path):
        result = resolve_safe_path(tmp_path, "a/b/c/file.md")
        assert result == tmp_path / "a" / "b" / "c" / "file.md"

    def test_is_within_true(self, tmp_path):
        child = tmp_path / "foo" / "bar.txt"
        assert is_within(tmp_path, child) is True

    def test_is_within_false(self, tmp_path):
        outside = Path("/etc/passwd")
        assert is_within(tmp_path, outside) is False


# ─── file_types ───────────────────────────────────────────────────────────────

class TestFileTypes:
    """FR: Only supported text formats must be opened in editor."""

    @pytest.mark.parametrize("filename", [
        "README.md", "notes.txt", "config.json", "schema.yaml",
        "app.ts", "component.tsx", "script.js", "page.jsx",
        "main.py", "index.html", "style.css", "query.sql", "run.sh",
    ])
    def test_supported_text_files(self, filename):
        assert is_text_file(filename) is True

    @pytest.mark.parametrize("filename", [
        "image.png", "archive.zip", "binary.exe", "data.bin",
        "photo.jpg", "video.mp4",
    ])
    def test_unsupported_files_not_text(self, filename):
        assert is_text_file(filename) is False

    def test_binary_detection_on_null_bytes(self):
        """NFR-SEC-02: Binary files must be detected and not opened as text."""
        with tempfile.NamedTemporaryFile(suffix=".dat", delete=False) as f:
            f.write(b"\x00\x01\x02binary\x00data")
            path = f.name
        assert is_binary_file(path) is True

    def test_text_file_not_binary(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("Hello world, this is plain text.")
            path = f.name
        assert is_binary_file(path) is False

    def test_get_language_markdown(self):
        assert get_language("README.md") == "markdown"

    def test_get_language_python(self):
        assert get_language("app.py") == "python"

    def test_get_language_typescript(self):
        assert get_language("store.ts") == "typescript"

    def test_get_language_unknown(self):
        assert get_language("Makefile") == "plaintext"

    def test_all_mvp_extensions_covered(self):
        """FR: All MVP-defined extensions must be in TEXT_EXTENSIONS."""
        required = {".md", ".txt", ".json", ".yaml", ".yml", ".ts", ".js",
                    ".py", ".tsx", ".jsx", ".html", ".css", ".sql", ".sh"}
        assert required.issubset(TEXT_EXTENSIONS)


# ─── diff_utils ───────────────────────────────────────────────────────────────

class TestDiffUtils:
    """FR: AI suggestions must return a diff, never silently rewrite files."""

    def test_diff_empty_to_content(self):
        diff = compute_unified_diff("", "hello world", "test.txt")
        assert "+hello world" in diff

    def test_diff_content_removed(self):
        diff = compute_unified_diff("hello world", "", "test.txt")
        assert "-hello world" in diff

    def test_diff_no_change_is_empty(self):
        diff = compute_unified_diff("same", "same", "test.txt")
        assert diff == ""

    def test_diff_contains_file_path(self):
        diff = compute_unified_diff("old", "new", "docs/readme.md")
        assert "docs/readme.md" in diff

    def test_diff_multiline(self):
        original = "line1\nline2\nline3"
        modified = "line1\nchanged\nline3"
        diff = compute_unified_diff(original, modified, "file.txt")
        assert "-line2" in diff
        assert "+changed" in diff

    def test_apply_diff_full_replace(self):
        original = "hello world"
        result = apply_diff_to_selection(original, 0, len(original), "goodbye world")
        assert result == "goodbye world"

    def test_apply_diff_partial_selection(self):
        original = "foo bar baz"
        # Replace "bar" (indices 4-7)
        result = apply_diff_to_selection(original, 4, 7, "qux")
        assert result == "foo qux baz"

    def test_apply_diff_preserves_surrounding_content(self):
        original = "prefix[REPLACE]suffix"
        start = original.index("[REPLACE]")
        end = start + len("[REPLACE]")
        result = apply_diff_to_selection(original, start, end, "NEW")
        assert result == "prefixNEWsuffix"
