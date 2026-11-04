"""Optional PostgreSQL connection utility; runtime repository migration is explicitly separate."""
from contextlib import contextmanager
from app.core.config import env

@contextmanager
def connect_postgres():
    dsn=env("POSTGRES_DSN")
    if not dsn:raise RuntimeError("POSTGRES_DSN chưa được cấu hình")
    try:import psycopg
    except ImportError as exc:raise RuntimeError("Cài requirements-postgres.txt để sử dụng connector PostgreSQL") from exc
    with psycopg.connect(dsn) as connection:
        yield connection
