"""Prompt schema definition."""
from __future__ import annotations

from typing import Any, List
from prompts.formatter import StrictFormatter
from prompts.base import BaseTemplate
from string import Formatter

formatter = StrictFormatter()


class PromptTemplate(BaseTemplate):

    def __init__(self, input_variables: List[str], template: str) -> None:
        self.input_variables = input_variables
        self.template = template

    def __add__(self, other: Any) -> PromptTemplate:
        """Override the + operator to allow for combining prompt templates."""
        # Allow for easy combining
        if isinstance(other, PromptTemplate):

            input_variables = list(
                set(self.input_variables) | set(other.input_variables)
            )
            template = self.template + other.template

            return PromptTemplate(
                template=template,
                input_variables=input_variables,
            )

        elif isinstance(other, str):
            prompt = PromptTemplate.from_template(other)
            return self + prompt
        else:
            raise NotImplementedError(f"Unsupported operand type for +: {type(other)}")

    def format(self, **kwargs: Any) -> str:
        """Format the prompt with the inputs."""

        return formatter.format(self.template, **kwargs)

    @classmethod
    def from_template(
        cls,
        template: str,
        input_variables: List[str] = None,
    ) -> PromptTemplate:
        """Load a prompt template from a template.

        Args:
            template: The template to load.
            template_format: The format of the template. Use `jinja2` for jinja2,
                             and `f-string` or None for f-strings.

        Returns:
            The prompt template loaded from the template.
        """

        input_variables = input_variables = {
            v for _, v, _, _ in Formatter().parse(template) if v is not None
        }

        return cls(
            input_variables=input_variables,
            template=template,
        )