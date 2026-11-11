import numpy as np

def normalize(vector):
    value = np.asarray(vector, dtype=np.float32)
    if value.ndim != 1 or not np.all(np.isfinite(value)):
        raise ValueError("Embedding phải là vector hữu hạn một chiều")
    norm = np.linalg.norm(value)
    return value / norm if norm > 1e-12 else None
