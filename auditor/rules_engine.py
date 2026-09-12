from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

from .scanner import parallel_search


@dataclass
class RuleResult:
    status: str
    explanation: str
    details: str
    scanned_files: str


@dataclass
class Rule:
    code: str
    title: str
    description: str
    regexes: List[str]
    min_hits: int = 1

    def evaluate(self, code_paths: List[str], max_workers: int = 8) -> RuleResult:
        findings = parallel_search(code_paths, self.regexes, max_workers=max_workers)
        total_hits = sum(len(v) for v in findings.values())
        status = "✅" if total_hits >= self.min_hits else "❌"
        explanation = "Найдены соответствующие паттерны" if status == "✅" else "Паттерны не обнаружены"
        details_parts: List[str] = []
        for fpath, matches in list(findings.items())[:50]:
            details_parts.append(f"{fpath}: {', '.join(str(m['line']) for m in matches[:5])}")
        details = "\n".join(details_parts)
        scanned_files = ", ".join(list(findings.keys())[:50])
        return RuleResult(status=status, explanation=explanation, details=details, scanned_files=scanned_files)


def builtin_rules_from_text(requirement_text: str) -> Optional[Rule]:
    text = requirement_text.lower()
    # Простая нормализация ключевых требований ВНД
    
    # Общие требования финансового учета/бизнес-стандартов
    if any(k in text for k in ["надежност", "стандарт", "соответств", "принцип"]) and any(k in text for k in ["финансов", "учет", "систем", "обеспеч"]):
        return Rule(
            code="business_standards",
            title="Бизнес-стандарты и надежность",
            description=requirement_text,
            regexes=[r"class\s+\w+", r"def\s+\w+", r"validate|check|verify", r"standard|policy|rule"],
            min_hits=2,
        )
    
    if "двойной" in text and ("запис" in text or "провод" in text or "бухгалтер" in text):
        return Rule(
            code="double_entry",
            title="Двойная запись",
            description=requirement_text,
            regexes=[r"\bdebit\b", r"\bcredit\b|\bкредит\b", r"entries?\b|ledger\b|проводк", r"balance.*=.*0|sum.*=.*0"],
            min_hits=2,
        )
    if "аутентифик" in text or "доступ" in text and ("требовать" in text or "огранич" in text):
        return Rule(
            code="auth_required",
            title="Ограниченный доступ",
            description=requirement_text,
            regexes=[r"@jwt_required|login_required|oauth|authmiddleware|authorize\(", r"/transactions|/ledger|/account"],
            min_hits=1,
        )
    if "аудит" in text and ("след" in text or "лог" in text):
        return Rule(
            code="audit_trail",
            title="Аудиторский след",
            description=requirement_text,
            regexes=[r"audit[_-]?log|auditable|логирован", r"CREATE\s+TRIGGER|ON\s+UPDATE|ON\s+DELETE"],
            min_hits=1,
        )
    if "шифр" in text or "конфиденц" in text:
        return Rule(
            code="encryption_at_rest",
            title="Шифрование данных",
            description=requirement_text,
            regexes=[r"from\s+cryptography|import\s+Fernet|sodium|pynacl|kms|vault|tink|aes|rsa", r"encrypt|decrypt|key\b"],
            min_hits=1,
        )
    if "sox" in text or "sarbanes" in text:
        return Rule(
            code="sox_controls",
            title="SOX контроль",
            description=requirement_text,
            regexes=[r"role[s-]?based|rbac|permission[s]?|policy|segregation\s+of\s+duties", r"report|отчет|audit\s+report"],
            min_hits=1,
        )
    if "валют" in text or "decimal" in text or "плавающ" in text:
        return Rule(
            code="decimal_usage",
            title="Decimal вместо float",
            description=requirement_text,
            regexes=[r"from\s+decimal\s+import\s+Decimal|\bDecimal\(", r"amount|balance|currency|сумм|баланс"],
            min_hits=1,
        )
    return None


def expand_code_paths(manifest: List[Dict], extensions: Optional[List[str]] = None) -> List[str]:
    if extensions is None:
        extensions = [
            ".py", ".js", ".ts", ".java", ".kt", ".scala", ".go", ".rb", ".cs", ".cpp", ".c", ".sql", ".yaml", ".yml", ".json",
        ]
    return [m["path"] for m in manifest if m.get("ext") in extensions]