from IPython.display import display, clear_output, HTML
import ipywidgets as widgets
from datetime import datetime
import pandas as pd
import time
from pipeline.agent import EnhancedAgent
from gigachat.models import Chat, Messages, MessagesRole

class JiraAnalyzerUI:
    def __init__(self, agent: EnhancedAgent):
        self.agent = agent
        self.chat_history = []
        self.setup_ui()

    def setup_ui(self):
        # Стили для красивого отображения
        self.setup_styles()

        # Основные элементы UI
        self.create_input_widgets()
        self.create_output_widgets()
        self.create_tabs()

        # Отображение
        display(self.main_tab)

    def setup_styles(self):
        display(HTML("""
        <style>
            .jira-widget {
                margin: 5px 0;
            }
            .jira-output {
                border: 1px solid #ddd;
                border-radius: 5px;
                padding: 10px;
                background: #f9f9f9;
            }
            .jira-button {
                font-weight: bold;
            }
            .jira-tab {
                padding: 10px;
            }
        </style>
        """))

    def create_input_widgets(self):
        """Создаем элементы для ввода запросов"""
        self.query_input = widgets.Textarea(
            placeholder='Введите ваш запрос (например: "Найди задачи с ошибками за последнюю неделю")',
            layout=widgets.Layout(width='100%', height='100px'),
            style={'description_width': 'initial'}
        )

        self.search_button = widgets.Button(
            description='🔍 Поиск',
            button_style='success',
            layout=widgets.Layout(width='120px'),
            style={'font_weight': 'bold'}
        )

        self.clear_button = widgets.Button(
            description='🧹 Очистить',
            button_style='warning',
            layout=widgets.Layout(width='120px')
        )

        self.progress = widgets.IntProgress(
            value=0, min=0, max=10,
            description='Обработка:',
            style={'bar_color': '#5fba7d'},
            layout=widgets.Layout(width='100%')
        )

        # Привязка событий
        self.search_button.on_click(self.execute_search)
        self.clear_button.on_click(self.clear_output)

    def create_output_widgets(self):
        """Создаем элементы для вывода результатов"""
        self.output_area = widgets.Output(
            layout={'border': '1px solid #ddd', 'width': '100%', 'height': '400px', 'overflow': 'auto'}
        )

        self.docs_table = widgets.Output(
            layout={'width': '100%', 'height': '400px', 'overflow': 'auto'}
        )

        self.history_table = widgets.Output(
            layout={'width': '100%', 'height': '400px', 'overflow': 'auto'}
        )

    def create_tabs(self):
        """Создаем вкладки интерфейса"""
        # Панель ввода
        input_panel = widgets.VBox([
            widgets.Label('📌 Введите запрос к базе Jira:'),
            self.query_input,
            widgets.HBox([self.search_button, self.clear_button]),
            self.progress
        ], layout=widgets.Layout(padding='10px'))

        # Вкладки
        self.main_tab = widgets.Tab()
        self.main_tab.children = [
            widgets.VBox([input_panel, self.output_area]),
            self.docs_table,
            self.history_table
        ]
        self.main_tab.set_title(0, '🔍 Поиск')
        self.main_tab.set_title(1, '📋 Найденные задачи')
        self.main_tab.set_title(2, '🕒 История запросов')

    def execute_search(self, b):
        """Обработка поискового запроса"""
        query = self.query_input.value.strip()
        if not query:
            with self.output_area:
                print("⚠️ Пожалуйста, введите запрос")
            return

        with self.output_area:
            clear_output(wait=True)
            print(f"🔎 Запрос: {query}\n")

            try:
                # Имитация прогресса (можно заменить на реальные шаги)
                self.agent.run()
                self.progress.value = 2
                time.sleep(0.1)

                # Используем существующую бизнес-логику
                contexts = self.agent.get_docs(query)
                prompt_template = self.agent.get_enhanced_prompt_template()
                self.progress.value = 6

                prompt = self.agent.get_enhanced_prompt_template().format(
                    contexts=contexts,
                    query=query
                )                

                messages = [
                    Messages(role=MessagesRole.SYSTEM, content="Ты помогаешь анализировать задачи Jira."),
                    Messages(role=MessagesRole.USER, content=prompt)
                ]

                self.progress.value = 8
                
                response = self.agent.chat.chat(Chat(messages=messages))
                answer = response.choices[0].message.content
                self.progress.value = 10
                print("doc start")
                for doc in contexts:
                    print("doc end")
                # Сохраняем историю
                self.chat_history.append({
                    'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    'query': query,
                    'answer': answer
                    # , 'docs': [doc.metadatas['key'] for doc in contexts]
                })

                # Выводим результаты
                print("📝 Результаты:\n")
                print(answer)

                # Обновляем таблицы
                self.update_docs_table(contexts)
                
                self.update_history_table()

            except Exception as e:
                print(f"❌ Ошибка: {str(e)}")
            finally:
                self.progress.value = 0

    def update_docs_table(self, docs):
        """Обновляем таблицу с найденными задачами"""
        print("Обновляем таблицу с найденными задачами")
        with self.docs_table:
            clear_output(wait=True)
            if not docs:
                print("Не найдено подходящих задач")
                return

            data = []
            for doc in docs:
                meta = doc.metadata
                data.append({
                    'Ключ': meta['key'],
                    'Проект': meta['project'],
                    'Создана': meta['created'][:10],
                    'Обновлена': meta['updated'][:10],
                    'Тип': self.get_issue_type(doc.page_content),
                    'Фрагмент': doc.page_content[:150] + '...'
                })

            df = pd.DataFrame(data)
            display(df.style
                   .set_properties(**{'text-align': 'left', 'max-width': '200px'})
                   .background_gradient(subset=['Проект'], cmap='Pastel1')
                   .set_table_styles([{
                       'selector': 'th',
                       'props': [('background', '#f0f0f0'), ('font-weight', 'bold')]
                   }]))

    def get_issue_type(self, text):
        """Определяем тип задачи по тексту"""
        if 'error' in text.lower() or 'exception' in text.lower():
            return '🐞 Ошибка'
        elif 'feature' in text.lower() or 'функционал' in text.lower():
            return '✨ Фича'
        elif 'bug' in text.lower():
            return '🐛 Баг'
        return '📌 Задача'

    def update_history_table(self):
        """Обновляем таблицу истории"""
        with self.history_table:
            clear_output(wait=True)
            if not self.chat_history:
                print("История запросов пуста")
                return

            df = pd.DataFrame(self.chat_history)
            display(df[['timestamp', 'query', 'docs']]
                    .style
                    .set_properties(**{'white-space': 'pre-wrap'})
                    .bar(subset=['docs'], color='#5fba7d')
                    .format({'docs': lambda x: len(x) if isinstance(x, list) else 0}))

    def clear_output(self, b):
        """Очищаем поле вывода"""
        with self.output_area:
            clear_output()
        self.query_input.value = ''

# Пример использования:
# 1. Сначала инициализируйте ваш агент (как в оригинальном коде) # agent = EnhancedAgent(jira_path="jira_data.json", ...) # agent.run()  # Это инициализирует необходимые компоненты

# 2. Затем создайте и отобразите UI
# ui = JiraAnalyzerUI(agent)