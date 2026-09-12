from __future__ import annotations

from pydantic import BaseModel, Field


class Document(BaseModel):
    """Class for storing a piece of text and associated metadata."""

    """String text."""
    page_content: str

    """Arbitrary metadata about the page content (e.g., source, relationships to other
        documents, etc.)."""
    metadata: dict = Field(default_factory=dict)