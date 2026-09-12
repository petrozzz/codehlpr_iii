import functools
from typing import Any, Callable, Tuple
import numpy as np

def tokenize(emb_function):
        
    return 


def jaccard_similarity(x, y):
    
    set1 = set(x)
    set2 = set(y)
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return float(intersection) / union

def xor_args(*arg_groups: Tuple[str, ...]) -> Callable:
    """Validate specified keyword args are mutually exclusive."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            """Validate exactly one arg in each group is not None."""
            counts = [
                sum(1 for arg in arg_group if kwargs.get(arg) is not None)
                for arg_group in arg_groups
            ]
            invalid_groups = [i for i, count in enumerate(counts) if count != 1]
            if invalid_groups:
                invalid_group_names = [", ".join(arg_groups[i]) for i in invalid_groups]
                raise ValueError(
                    "Exactly one argument in each of the following"
                    " groups must be defined:"
                    f" {', '.join(invalid_group_names)}"
                )
            return func(*args, **kwargs)

        return wrapper

    return decorator