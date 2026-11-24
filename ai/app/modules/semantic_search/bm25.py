"""Lexical BM25 baseline: k1=1.2, b=0.75; Vietnamese folded syllable tokens."""
import math
from collections import Counter
from .text_utils import folded, STOPWORDS


def bm25(query, documents):
    terms = set(folded(query).split()) - STOPWORDS
    counts = [Counter(folded(doc).split()) for doc in documents]
    average = sum(sum(c.values()) for c in counts) / max(1, len(counts)) or 1
    scores = [0.0] * len(documents)
    for term in terms:
        df = sum(term in c for c in counts)
        idf = math.log(1 + (len(counts) - df + 0.5) / (df + 0.5))
        for index, count in enumerate(counts):
            tf = count[term]
            if tf:
                scores[index] += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * sum(count.values()) / average))
    return scores
