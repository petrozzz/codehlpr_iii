from vectorstores import FAISS
from embeddings import HuggingFaceEmbeddings
from gigachat import GigaChat
from prompts import PromptTemplate
from langchain.schema import HumanMessage, SystemMessage
from gigachat.models import Chat, Messages, MessagesRole
import os
import json
import torch


GIGACHAT_API_URL = os.environ.get("GIGACHAT_API_URL")
ACCESS_TOKEN = os.environ.get("JPY_API_TOKEN")


def load_jira_file(path: str):
    with open(r'{}'.format(path), 'r', encoding = 'utf-8') as f:
        commits = json.load(f)
    texts = []    
    for comm in commits:
        if 'description' in comm.keys() and 'comments' not in comm.keys():
            texts.append(str(comm))
        elif 'description' not in comm.keys() and 'comments' in comm.keys():
            texts.append(str(comm))
        elif 'description' not in comm.keys() and 'comments' not in comm.keys():
            texts.append(str(comm))
        else:
            texts.append(str(comm))
        meta = [{'project': comm['project'], 'key': comm['key']} for comm in commits]
    
    return texts, meta

class Agent():
    def __init__(self, 
                 jira_path: str,
                 k: int = None,
                 database_type: str = 'faiss',
                 database_path: str = './database'
                ):
        
        self.k = k if k is not None else 5
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.path = jira_path
        self.database_path = database_path
        self.database_type = database_type
        self.embedding_model = HuggingFaceEmbeddings(
                                                path='./model/embeddings/',
                                                model_kwargs={"device": self.device},
                                                encode_kwargs={"device": self.device, 'batch_size': 32}
                                             )
        
    def check_database_exists(self) -> bool:
       
        if not os.path.exists(self.database_path):
            return False
        
        db_to_format = {'faiss': 'faiss'}
        
        for file in os.listdir(self.database_path):
            if file.endswith(db_to_format[self.database_type]):
                return True
        return False
    
    def build_database(self):
        
        texts, meta = load_jira_file(self.path)
        
        if self.database_type == 'faiss':
            vectorstore = FAISS.from_texts(
                                            texts = texts,
                                            metadatas = meta,
                                            embedding = self.embedding_model
                                        )

            vectorstore.save_local(self.database_path)
        
        retriever = vectorstore.as_retriever(search_type = 'similarity', search_kwargs = {'k': self.k})
        
        return retriever
    
    def run(self):
        
        if self.check_database_exists() is False:
            retriever = self.build_database()
        else:
            retriever = FAISS.load_local(self.database_path,
                                        embeddings=self.embedding_model,
                                        allow_dangerous_deserialization=True).as_retriever(search_type = 'similarity', search_kwargs = {'k': self.k})
            
        retriever = self.build_database()
        
        chat = GigaChat(
            base_url=GIGACHAT_API_URL,
            access_token=ACCESS_TOKEN,
            model="GigaChat-2-Max"  # check available SmartNLP models
        )

        
        
        template = """Тебе даны описания задач json из Jira в формате: 
                    1. project - название проекта, 
                    2. key - идентификатор задачи, 
                    3. updated - время обновления задачи, 
                    4. created - время создания задачи, 
                    5. summary - название задачи, 
                    6. description - описание задачи, 
                    7. comments - комментарии к задаче (comment_body - текст комментария, comment_last_update - время внесения комментария). 
        Твоя задача проанализироват эту информацию и ответить на вопросы, Ответ должен быть структурирован, понятен и обязательно содержать идентификатор задачи (key)  в случае, есди ты будешь ссылаться на задачу в ответе.Задачи никак не связанные с вопросом выводить не нужно. Ни в коем случае не выводи json в сыром виде. Вот описание задач: {contexts}. Проанализируй их и ответь на следующий вопрос: {query}"""
        
        prompttemplate = PromptTemplate(template = template, input_variables = ['contexts', 'query'])
        messages = []
        while True:
            query = input('Введите запрос: ')
            
            if len(messages) == 0:
                contexts = str(retriever._get_relevant_documents(query))
            else:
                contexts = ''
                
            user_input = prompttemplate.format(contexts = contexts, query = query)
            
            print("user_input")
            print(user_input)
            message = [
                Messages(
                    role = MessagesRole.USER,
                    content = user_input
                    )
                ]
            
            messages+=(message)
            res = chat.chat(Chat(messages = messages))
            
            message = [
                Messages(
                    role = MessagesRole.ASSISTANT,
                    content = res.choices[0].message.content
                    )
                ]
            
            messages+=(message)
            print("Bot: ", res.choices[0].message.content)