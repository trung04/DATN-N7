"""Evaluate a frozen training snapshot against disjoint, future relevant-item labels.

JSONL labels: {"user_id":"u", "relevant_place_ids":["a"], "city":"Đà Nẵng"}
The snapshot must contain only data available at --cutoff, including user preferences,
reviews, embeddings, aggregate ratings and catalog. This script cannot reconstruct that
historical catalog from a current database. Use validation labels to tune; test only once.
"""
import argparse
import json
import sqlite3
import sys
import tempfile
from dataclasses import replace
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.modules.recommendation.evaluation import ranking_metrics
from app.modules.recommendation.schemas import RecommendationRequest
from app.modules.recommendation.hybrid_service import RecommendationService, RankingConfig
from app.database.sqlite import Store


class ExactRetrieval:
    def candidates(self, *args):
        return []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train-db", type=Path, required=True)
    parser.add_argument("--labels", type=Path, required=True)
    parser.add_argument("--cutoff", required=True, help="Timezone-aware ISO timestamp of the training boundary")
    parser.add_argument("--k", type=int, default=10, choices=range(1, 101))
    parser.add_argument("--confirm-historical-snapshot", action="store_true", required=True)
    args = parser.parse_args()
    cutoff = datetime.fromisoformat(args.cutoff)
    if cutoff.tzinfo is None:
        parser.error("--cutoff must include timezone")
    if not args.train_db.is_file():
        parser.error("Training database does not exist")
    labels = [json.loads(line) for line in args.labels.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not labels or any(not x.get("relevant_place_ids") for x in labels):
        parser.error("Every label must include at least one relevant_place_id")
    if len({x["user_id"] for x in labels}) != len(labels):
        parser.error("One label record per user is required")
    with tempfile.TemporaryDirectory() as tmp:
        # Read-only source connection + SQLite backup handles WAL correctly.
        source = sqlite3.connect(args.train_db.resolve().as_uri() + "?mode=ro", uri=True)
        target = sqlite3.connect(str(Path(tmp) / "snapshot.sqlite"))
        try:
            source.backup(target)
        finally:
            source.close()
            target.close()
        store = Store(Path(tmp) / "snapshot.sqlite")
        if any(datetime.fromisoformat(e["occurred_at"]) >= cutoff for e in store.events()):
            parser.error("Training snapshot contains events at/after cutoff")
        catalog = {r["id"] for r in store.places()}
        if any(not set(x["relevant_place_ids"]) <= catalog for x in labels):
            parser.error("Labels contain unknown places; evaluate new-item cold start separately")
        from app.modules.semantic_search.embedding_service import EmbeddingService
        encoder = EmbeddingService()
        # This evaluator compares the deferred behavioral hybrid variants explicitly.
        cfg = replace(RankingConfig.from_env(), mode="hybrid")
        model = RecommendationService(store, encoder, None, config=cfg)
        model.content = ExactRetrieval()
        if any(r["model"] != model.model or not r["vector"] or not r["content_hash"] for r in store.places()):
            parser.error("Snapshot embeddings differ from configured model/document version or are incomplete")
        totals = {"hybrid": [], "content_quality_context": [], "quality_baseline": []}
        for label in labels:
            request = RecommendationRequest(user_id=label["user_id"], city=label.get("city"),
                place_type=label.get("place_type"), limit=args.k, exploration=False, exclude_seen=True)
            seen = {e["place_id"] for e in store.events(label["user_id"])}
            if set(label["relevant_place_ids"]) & seen:
                parser.error("Repeat-visit labels conflict with exclude_seen evaluation; use a separate protocol")
            for name, config in [("hybrid", cfg), ("content_quality_context",replace(cfg,collaborative_weight=0)),
                                ("quality_baseline", replace(cfg, content_weight=0,
                                  collaborative_weight=0, distance_weight=0, diversity_penalty=0,repeat_penalty=0))]:
                model.config = config
                result = model.recommend(request, now=cutoff, log=False)
                ids = [x["place_id"] for x in result["recommendations"]]
                totals[name].append(ranking_metrics(ids, label["relevant_place_ids"], args.k))
        output = {name: {key: sum(row[key] for row in rows)/len(rows) for key in rows[0]}
                  for name, rows in totals.items()}
        print(json.dumps({"users": len(labels), "k": args.k, "metrics": output}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
