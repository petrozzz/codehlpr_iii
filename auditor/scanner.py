import os
import re
# from concurrent.futures import ThreadPoolExecutor, as_completed  # Убираем многопоточность
from typing import Dict, Iterable, List, Optional, Tuple


TextMatch = Dict[str, object]


def iter_text_lines(path: str, max_line_length: int = 10000):
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            for lineno, line in enumerate(f, start=1):
                if len(line) > max_line_length:
                    line = line[:max_line_length]
                yield lineno, line
    except Exception:
        return


def search_file_for_patterns(path: str, patterns: List[re.Pattern]) -> List[TextMatch]:
    matches: List[TextMatch] = []
    for lineno, line in iter_text_lines(path):
        for pat in patterns:
            m = pat.search(line)
            if m:
                excerpt = line.strip()
                matches.append({
                    "line": lineno,
                    "excerpt": excerpt if len(excerpt) <= 500 else excerpt[:500] + "…",
                    "pattern": pat.pattern,
                })
    return matches


def parallel_search(paths: List[str], regexes: List[str], max_workers: int = 1) -> Dict[str, List[TextMatch]]:
    """Последовательный поиск (многопоточность убрана для стабильности WebSocket)"""
    compiled = [re.compile(r, flags=re.IGNORECASE) for r in regexes]
    results: Dict[str, List[TextMatch]] = {}
    
    for p in paths:
        try:
            file_matches = search_file_for_patterns(p, compiled)
            if file_matches:
                results[p] = file_matches
        except Exception:
            pass  # Игнорируем ошибки файлов
    
    return results


def collect_relevant_lines(results: Dict[str, List[TextMatch]], context_lines: int = 2) -> List[str]:
    snippets: List[str] = []
    for fpath, matches in results.items():
        try:
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            for m in matches[:5]:
                ln = int(m.get('line', 1))
                start = max(1, ln - context_lines)
                end = min(len(lines), ln + context_lines)
                block = ''.join(lines[start-1:end])
                snippets.append(f"File: {fpath}\nLines: {start}-{end}\n---\n{block}")
        except Exception:
            continue
    return snippets


def _symbol_patterns(symbol: str) -> List[re.Pattern]:
    escaped = re.escape(symbol)
    patterns = [
        rf"\bdef\s+{escaped}\s*\(",  # Python
        rf"\bclass\s+{escaped}\b",  # classes
        rf"\bfunction\s+{escaped}\s*\(",  # JS/TS
        rf"\b{escaped}\s*=\s*\(.*?\)\s*=>",  # arrow func
        rf"\bexport\s+function\s+{escaped}\s*\(",
        rf"\b(public|private|protected)?\s*(static\s+)?[\w\<\>\[\]]+\s+{escaped}\s*\(",  # Java/C#/C++ rough
        rf"\bfunc\s+\(?.*?\)?\s*{escaped}\s*\(",  # Go
        rf"CREATE\s+FUNCTION\s+{escaped}\b",  # SQL
    ]
    return [re.compile(p, flags=re.IGNORECASE) for p in patterns]


def extract_code_block(path: str, start_line: int, num_before: int = 2, num_after: int = 12) -> str:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
        s = max(1, start_line - num_before)
        e = min(len(lines), start_line + num_after)
        block = "".join(lines[s-1:e])
        return block
    except Exception:
        return ""


def find_symbol_definitions(paths: List[str], symbol: str, max_files: int = 20) -> Dict[str, List[TextMatch]]:
    pats = _symbol_patterns(symbol)
    results: Dict[str, List[TextMatch]] = {}
    count = 0
    for p in paths:
        if count >= max_files:
            break
        file_matches: List[TextMatch] = []
        for lineno, line in iter_text_lines(p):
            for pat in pats:
                if pat.search(line):
                    file_matches.append({"line": lineno, "excerpt": line.strip(), "pattern": pat.pattern})
                    break
        if file_matches:
            results[p] = file_matches
            count += 1
    return results