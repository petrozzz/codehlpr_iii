import torch
from vectorstores import FAISS
from embeddings import HuggingFaceEmbeddings
from gigachat import GigaChat
from prompts import PromptTemplate
import os
import json
from typing import List, Dict, Tuple
from pydantic import BaseModel


GIGACHAT_API_URL = os.environ.get("GIGACHAT_API_URL")
ACCESS_TOKEN = os.environ.get("JPY_API_TOKEN")

class JiraIssue(BaseModel):
    project: str
    key: str
    updated: str
    created: str
    summary: str
    description: str = None
    comments: List[Dict] = []

class EnhancedAgent:
    def __init__(
        self,
        jira_path: str,
        k: int = 5,
        database_type: str = 'faiss',
        database_path: str = './database',
        embedding_model_path: str = './model/embeddings/'
    ):
        self.k = k
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.jira_path = jira_path
        self.database_path = database_path
        self.database_type = database_type
        # Оптимизированные параметры для FAISS
        self.faiss_index_config = {
            'metric_type': 'METRIC_INNER_PRODUCT',  # Эквивалентно косинусному сходству при нормализованных векторах
            'nlist': 100,  # Количество кластеров для ускорения поиска
            'nprobe': 10   # Количество кластеров для поиска
        }

        # Улучшенная модель эмбеддингов с кэшированием
        self.embedding_model = HuggingFaceEmbeddings(
            path=embedding_model_path,
            model_kwargs={"device": self.device},
            encode_kwargs={
                "device": self.device,
                "batch_size": 64,
                "normalize_embeddings": True  # Для лучшего косинусного сходства
            }
        )
        self.chat = None
        self.chat_history = []
        self.retriever = None
        self.prompt_template = None

        

    def _preprocess_text(self, text: str) -> str:
        """Очистка и нормализация текста перед созданием эмбеддингов"""
        if not text:
            return ""
        # Удаление спецсимволов, лишних пробелов и т.д.
        text = ' '.join(text.split())
        return text.strip()

    def load_jira_data(self) -> Tuple[List[str], List[Dict]]:
        """Улучшенная загрузка и предобработка данных Jira"""
        with open(self.jira_path, 'r', encoding='utf-8') as f:
            issues = json.load(f)

        texts = []
        meta = []

        for issue in issues:
            # Создаем структурированный текст для лучшего поиска
            text_parts = [
                f"Project: {issue.get('project', '')}",
                f"Key: {issue.get('key', '')}",
                f"Summary: {issue.get('summary', '')}",
                f"Description: {self._preprocess_text(issue.get('description', ''))}",
                "Comments:"
            ]

            # Обработка комментариев
            for comment in issue.get('comments', []):
                text_parts.append(f"Comment: {self._preprocess_text(comment.get('comment_body', ''))}")

            full_text = "\n".join(text_parts)
            texts.append(full_text)

            # Метаданные для фильтрации
            meta.append({
                'project': issue.get('project', ''),
                'key': issue.get('key', ''),
                'created': issue.get('created', ''),
                'updated': issue.get('updated', '')
            })

        return texts, meta

    def check_database_exists(self) -> bool:
        """Проверка существования векторной БД с улучшенной валидацией"""
        if not os.path.exists(self.database_path):
            return False

        required_files = {
            'faiss': ['index.faiss', 'index.pkl']
        }

        db_files = os.listdir(self.database_path)
        return all(f in db_files for f in required_files[self.database_type])

    def build_database(self):
        """Улучшенное создание векторной базы с индексацией"""
        texts, meta = self.load_jira_data()

        if self.database_type == 'faiss':
            vectorstore = FAISS.from_texts(
                texts=texts,
                metadatas=meta,
                embedding=self.embedding_model,
                # index_config=self.faiss_index_config
            )

            # Оптимизация индекса
            vectorstore.index.nprobe = self.faiss_index_config['nprobe']
            vectorstore.save_local(self.database_path)

        # Создаем ретривер с гибридным поиском (похожесть + ключевые слова)
        retriever = vectorstore.as_retriever(
            search_type="similarity",  # Maximal Marginal Relevance для баланса релевантности и разнообразия
            search_kwargs={
                'k': self.k,
                'lambda_mult': 0.5,  # Коэффициент для MMR (0.5 - баланс)
                'filter': None,       # Можно добавить фильтры по проекту/дате
                'fetch_k': 50         # Количество кандидатов для MMR
            }
        )
        
        

        return retriever

    def get_enhanced_prompt_template(self) -> PromptTemplate:
        """Улучшенный шаблон для более точных ответов"""
        template = """Ты - эксперт по анализу задач Jira. Тебе предоставлена информация о задачах:

        Контекст: {contexts}

        Инструкции:
        1. Анализируй только релевантные задачи
        2. В ответе всегда указывай ключи задач (SUBS-XXXXX)
        3. Группируй задачи по темам, если это уместно
        4. Для технических задач выделяй основные ошибки/проблемы
        5. Для feature-запросов выделяй основную функциональность
        6. Отвечай структурированно, используя маркированные списки

        Вопрос: {query}

        Ответ:"""

        return PromptTemplate(template=template, input_variables=['contexts', 'query'])

    def run(self):
        """Улучшенный процесс поиска и генерации ответов"""
        # Инициализация векторного хранилища
        if not self.check_database_exists():
            print("Building new vector database...")
            self.retriever = self.build_database()
        else:
            print("Loading existing vector database...")
            vectorstore = FAISS.load_local(
                self.database_path,
                embeddings=self.embedding_model,
                allow_dangerous_deserialization=True
            )
            self.retriever = vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={
                    'k': self.k,
                    'lambda_mult': 0.5,
                    'fetch_k': 50
                }
            )

        # Инициализация модели чата
        self.chat = GigaChat(
            base_url=GIGACHAT_API_URL,
            access_token=ACCESS_TOKEN,
            model="GigaChat-2-Max",
            # temperature=0.3  # Для более точных ответов
        )

        self.prompt_template = self.get_enhanced_prompt_template()
        # self.chat_history = []

#         while True:
#             try:
#                 query = input('Введите запрос (или "exit" для выхода): ')
#                 if query.lower() == 'exit':
#                     break

#                 # Поиск релевантных документов
#                 # docs = retriever._get_relevant_documents(query)
#                 contexts = retriever._get_relevant_documents(query)
                
#                 # contexts = "\n\n".join([doc.page_content for doc in docs])

#                 # Формирование промпта
#                 prompt = prompt_template.format(contexts=contexts, query=query)

#                 # # Логирование для отладки
#                 # print("\nDebug: Retrieved documents:", len(docs))
#                 # for i, doc in enumerate(docs, 1):
#                 #     print(f"\nDoc {i} (Key: {doc.metadata['key']}):")
#                 #     print(doc.page_content[:200] + "...")

#                 # Генерация ответа
#                 messages = [
#                     Messages(role=MessagesRole.SYSTEM, content="Ты помогаешь анализировать задачи Jira."),
#                     Messages(role=MessagesRole.USER, content=prompt)
#                 ]

#                 response = chat.chat(Chat(messages=messages))
#                 answer = response.choices[0].message.content

#                 # Сохранение истории
#                 chat_history.extend([
#                     Messages(role=MessagesRole.USER, content=query),
#                     Messages(role=MessagesRole.ASSISTANT, content=answer)
#                 ])

#                 # Вывод форматированного ответа
#                 print("\nОтвет:")
#                 print(answer)
#                 print("\n" + "="*50 + "\n")

#             except Exception as e:
#                 print(f"Ошибка: {str(e)}")
#                 continue

# if __name__ == "__main__":
#     agent = EnhancedAgent(
#         jira_path="jira_data.json",
#         k=5,
#         database_path="./jira_vector_db"
#     )
#     agent.run()
    def get_docs(self, query):
        contexts = self.retriever._get_relevant_documents(query)
        # docs = self.retriever.invoke(query)
        return contexts