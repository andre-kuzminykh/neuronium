TEXT_EXTENSIONS = {
    ".md", ".txt", ".json", ".yaml", ".yml",
    ".ts", ".js", ".py", ".tsx", ".jsx",
    ".html", ".css", ".sql", ".sh",
    ".toml", ".cfg", ".ini", ".env",
    ".xml", ".csv", ".log", ".rst",
    ".gitignore", ".dockerignore",
}

LANGUAGE_MAP = {
    ".md": "markdown",
    ".txt": "plaintext",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".py": "python",
    ".html": "html",
    ".css": "css",
    ".sql": "sql",
    ".sh": "shell",
    ".toml": "toml",
    ".xml": "xml",
}


def is_text_file(filename: str) -> bool:
    """Check if file extension is in supported text list."""
    from pathlib import Path
    suffix = Path(filename).suffix.lower()
    # Also check files with no extension (Makefile, Dockerfile, etc.)
    if not suffix:
        return True
    return suffix in TEXT_EXTENSIONS


def get_language(filename: str) -> str:
    from pathlib import Path
    suffix = Path(filename).suffix.lower()
    return LANGUAGE_MAP.get(suffix, "plaintext")


def is_binary_file(file_path: str) -> bool:
    """Quick binary detection by reading first chunk."""
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(8192)
        # Check for null bytes
        if b"\x00" in chunk:
            return True
        return False
    except (IOError, OSError):
        return True
