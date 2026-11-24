import logging
from .config import env

def configure_logging():
    logging.basicConfig(level=env("LOG_LEVEL","INFO"),format="%(asctime)s %(levelname)s %(name)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
