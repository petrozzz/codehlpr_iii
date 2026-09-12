from __future__ import annotations
from base.documents import Document
from vectorstores.base import VectorStore
from vectorstores.utils import jaccard_similarity
import pandas as pd
import os
import uuid
import numpy as np
from typing import (
                    List, 
                    Optional, 
                    Tuple, 
                    Any,
                    Callable, 
                    Type
                    )

class TableVectorStore(VectorStore):

    vectorstore: pd.DataFrame
    database_name = 'database.feather'

    def __init__(self, persistent_path: str = None,
                 vectorstore: pd.DataFrame = None,
                 ) -> None:
        """
        Initialize the class with the provided database path, database type, database name, search type, and search keyword arguments.

        Parameters:
            database_path (str): The path to the database.
            database_type (str): The type of the database, default is "csv".
            database_name (str, optional): The name of the database, default is "database".
            search_type (str, optional): The type of search to be performed, default is "similarity".
            search_kwargs (dict, optional): Additional keyword arguments for the search.

        Returns:
            pd.DataFrame: The initialized DataFrame.
        """
        if vectorstore is not None:
            self.vectorstore = vectorstore
        else:
            database_path = os.path.join(persistent_path, self.database_name)
            if os.path.exists(database_path):
                self.vectorstore = pd.read_feather(database_path)
            else:
                raise ValueError(f'{database_path} does not exist')

    def save_local(self, database_path: str = None):
        """
        Save the data stored in the vectorstore to a CSV file locally.
        """
        database_path = os.path.join(database_path, self.database_name)
        self.vectorstore = self.vectorstore.reset_index(drop=True)
        self.vectorstore.to_feather(database_path)

    @classmethod
    def from_texts(self,
                   texts: list[str],
                   ids: Optional[List[str]] = None,
                   metadatas: Optional[List[dict]] = None,
                   embedding = None,
                   ) -> TableVectorStore:
        """
        A method to generate a CsvVectorStore from the provided texts, ids, and optional metadatas.

        Parameters:
            texts (list[str]): A list of texts to be included in the CsvVectorStore.
            ids (Optional[List[str]]): A list of ids corresponding to each text. If not provided, new ids will be generated.
            metadatas (Optional[List[dict]]): A list of dictionaries containing metadata for each text.

        Returns:
            CsvVectorStore: A CsvVectorStore object containing the texts, ids, and optional metadatas.
        """

        if ids is None:
            ids = [str(uuid.uuid4()) for _ in texts]

        embeddings = embedding.embed_documents(texts)

        if metadatas is not None:
            vectorstore = pd.DataFrame({"text": texts, "idxs": ids, "embeddings": embeddings, "metadatas": metadatas})
        else:
            vectorstore = pd.DataFrame({"text": texts, "idxs": ids, "embeddings": embeddings})

        return TableVectorStore(vectorstore=vectorstore)

    def add_texts(self, data: List[str], ids: Optional[List[str]] = None) -> None:
        """
        Add texts to the vectorstore along with optional ids. If ids are not provided, generate new ids using uuid.uuid4. Update the vectorstore with the new data.
        Parameters:
            data: List[str] - the list of text data to be added
            ids: Optional[List[str]] - (optional) the list of ids corresponding to the text data
        Return:
            None
        """
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in data]

        embeddings = embedding.embed_documents(texts)
        lines = []
        for line, idx, emb in zip(data, ids, embeddings):
            lines.append([line, idx, emb])

        self.vectorstore = self.vectorstore._append(pd.DataFrame(lines, columns=self.vectorstore.columns))

    def similarity_search(self, query: str, k: int = 4) -> List[Tuple[Document, float]]:
        """
        Perform a similarity search using Jaccard similarity between the query and texts in the vector store.

        Args:
            query (str): The query string to compare against the texts in the vector store.
            k (int): The number of top results to return. Defaults to 4.

        Returns:
            List[Tuple[Document, float]]: A list of tuples containing the Document and the similarity score.
        """
        top_k_contexts = []
        query_embed = np.array(embed_query(query))
        self.vectorstore['similaty'] = self.vectorstore.embeddings.apply(lambda x: jaccard_similarity(query_embed, x))
                    
        top_k_contexts = self.vectorstore.sort_values(by='similaty', ascending=False).head(k)[['text', 'similaty']].values
        return [doc for doc, _ in top_k_contexts]

    def delete_by_index(self, index):
        """
        Delete items from the vectorstore by their index.

        Parameters:
            index (list): The list of indices to be deleted from the vectorstore.

        Returns:
            None
        """
        for id in index:
            idx = self.vectorstore.loc[self.vectorstore['idxs'] == id].index
            self.vectorstore = self.vectorstore.drop(idx)

    def _select_relevance_score_fn(self) -> Callable[[float], float]:
        """
        Selects the relevance score function based on the current state of the object.
        """
        return self._jaccard_similarity_relevance_score_fn

    def similarity_search_with_score(self, query: str,
                                                k: int = 4,
                                                **kwargs: Any,
                                                ) -> List[Tuple[Document, float]]:
        """
        Perform a similarity search with relevance scores.

        Parameters:
            query (str): The query string for the search.
            k (int): The number of top results to retrieve (default is 4).
            score_threshold (float): The minimum score threshold for results to be included (default is 0.5).

        Returns:
            List[Tuple[Document, float]]: A list of tuples containing Document objects and their corresponding similarity scores.
        """
        top_k_contexts = []
        query_embed = np.array(embed_query(query))

        self.vectorstore['similaty'] = self.vectorstore.embeddings.apply(lambda x: jaccard_similarity(query_embed, x))
        
        top_k_contexts = self.vectorstore.sort_values(by='similaty', ascending=False).head(k)[['text', 'similaty']].values

        return [(doc, score) for doc, score in top_k_contexts]