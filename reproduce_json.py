import re
import json

def _extract_json(text: str):
    print(f"Analyzing text: {text[:50]}...")
    
    # Method 2.5
    markdown_json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text, re.DOTALL)
    if markdown_json_match:
        print("Method 2.5 matched!")
        content = markdown_json_match.group(1)
        print(f"Content: {content}")
        try:
            return json.loads(content)
        except Exception as e:
            print(f"Method 2.5 JSON error: {e}")
    else:
        print("Method 2.5 did NOT match")

    return None

test_input = """```json
{
  "final": false,
  "status": "❓",
  "findings": [
    "В файле VND_new/auditor/rules_engine.py:91 найдено упоминание 'report' в контексте SOX контроля.",
    "Прочитан код VND_new/auditor/rules_engine.py:81-101, но он относится к определению правил аудита, а не к функциональности скачивания отчетов.",
    "Не найдено явной реализации функции скачивания отчетов в изученных файлах."
  ],
  "confidence": 0.3
}