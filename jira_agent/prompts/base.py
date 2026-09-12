from __future__ import annotations
from abc import ABC, abstractmethod
from pathlib import Path
import yaml
import json
from typing import Any, Union, List, TypeVar, Dict

BT = TypeVar("BT", bound="BaseTemplate")


class BaseTemplate(ABC):
    """Base class for all templates."""

    @abstractmethod
    def format(self, **kwargs: Any) -> str:
        """Format the template with the given arguments."""
        raise NotImplementedError

    @classmethod
    def from_file(
        cls,
        template_file: Union[str, Path],
        input_variables: List[str] = None,
    ) -> BT:
        """Load a prompt from a file.

        Args:
            template_file: The path to the file containing the prompt template.
            input_variables: [DEPRECATED] A list of variable names the final prompt
                template will expect.

        input_variables is ignored as from_file now delegates to from_template().

        Returns:
            The prompt loaded from the file.
        """
        if template_file.endswith(".json"):
            with open(template_file, "r") as f:
                template = json.load(f)

        elif template_file.endswith((".yaml", ".yml")):
            template = {}
            with open(template_file, "r") as f:
                template = yaml.safe_load(f)
        else:
            raise ValueError(f"{template_file} must be json or yaml")

        return cls.from_template(**template)

    def dict(self, **kwargs: Any) -> Dict:
        """Return dictionary representation of prompt."""
        prompt_dict = self.__dict__.copy()

        return prompt_dict

    def save(self, file_path: Union[Path, str]) -> None:
        """Save the prompt.

        Args:
            file_path: Path to directory to save prompt to.

        Example:
        .. code-block:: python

            prompt.save(file_path="path/prompt.yaml")
        """

        # Fetch dictionary to save
        prompt_dict = self.dict()

        if isinstance(file_path, str):
            save_path = Path(file_path)
        else:
            save_path = file_path

        directory_path = save_path.parent
        directory_path.mkdir(parents=True, exist_ok=True)

        if save_path.suffix == ".json":
            with open(file_path, "w") as f:
                json.dump(prompt_dict, f, indent=4)
        elif save_path.suffix.endswith((".yaml", ".yml")):
            with open(file_path, "w") as f:
                yaml.dump(prompt_dict, f, default_flow_style=False)
        else:
            raise ValueError(f"{save_path} must be json or yaml")