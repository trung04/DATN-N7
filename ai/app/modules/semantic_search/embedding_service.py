from app.core.config import env
from app.core.config import load_environment
import logging

from sentence_transformers import SentenceTransformer

logger=logging.getLogger(__name__)


class EmbeddingService:
    
    def __init__(self):
        load_environment()
        self.model_name = env(
           "MODEL_NAME","BAAI/bge-m3"
        )
        
        self.device =  "cpu"
        
        logger.info("Loading model %s on %s",self.model_name,self.device)
        
        self.model = SentenceTransformer(self.model_name, device=self.device)
        dimension_getter=getattr(self.model,"get_embedding_dimension",None) or self.model.get_sentence_embedding_dimension
        self.dimensions = dimension_getter()
        self.batch_size = int(env("BATCH_SIZE", 16))
        self.max_text_length = int(env("MAX_TEXT_LENGTH", 8000))
        
        logger.info("Model loaded; embedding dimensions=%s",self.dimensions)
     
    def _validate_text(self,text:str) -> str:
        text = text.strip()
        if not text:
            raise ValueError("Chuỗi văn bản không được rỗng.")
        if len(text)>self.max_text_length:
            raise ValueError(f"Chuỗi văn bản vượt quá độ dài tối đa {self.max_text_length} ký tự.")
        return text 
    
    def embed_text(self, text: str) -> list[float]:
        text = self._validate_text(text=text)
        embedding = self.model.encode(text,  normalize_embeddings=True ,convert_to_numpy=True)
        # chuẩn hóa độ dài của embedding về 1 và trả về dưới dạng list thay vì tensor 
        return embedding.tolist()
    
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        
        texts = [self._validate_text(text) for text in texts]
        embeddings = self.model.encode(texts, batch_size=self.batch_size, normalize_embeddings=True, convert_to_numpy=True)
        
        return embeddings.tolist()
       
        
        
