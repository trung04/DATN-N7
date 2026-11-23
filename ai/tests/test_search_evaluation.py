import math
import unittest
from evaluation.metrics import ranking_metrics, percentile


class SearchEvaluationTests(unittest.TestCase):
    def test_perfect_ranking(self):
        result=ranking_metrics(['a','b'],{'a':3,'b':2,'c':0},2)
        self.assertEqual(result['recall'],1)
        self.assertEqual(result['mrr'],1)
        self.assertEqual(result['ndcg'],1)

    def test_recall_denominator_is_all_relevant_not_k(self):
        result=ranking_metrics(['x','b','a'],{'a':3,'b':2,'c':2,'x':0},2)
        self.assertAlmostEqual(result['recall'],1/3)
        self.assertEqual(result['mrr'],.5)
        self.assertAlmostEqual(result['ndcg'],(3/math.log2(3))/(7+3/math.log2(3)))

    def test_grade_one_counts_for_ndcg_not_binary_relevance(self):
        result=ranking_metrics(['weak'],{'weak':1,'strong':3},1)
        self.assertEqual(result['recall'],0)
        self.assertEqual(result['mrr'],0)
        self.assertAlmostEqual(result['ndcg'],1/7)

    def test_no_positives_not_misreported_as_perfect_recall(self):
        result=ranking_metrics(['a'],{'a':0},5)
        self.assertIsNone(result['recall']);self.assertIsNone(result['mrr']);self.assertIsNone(result['ndcg'])

    def test_unjudged_and_short_results(self):
        result=ranking_metrics(['unknown','a'],{'a':3,'b':2},10)
        self.assertEqual(result['judged_coverage'],.5)
        self.assertEqual(result['recall'],.5)
        self.assertEqual(result['returned'],2)

    def test_empty_or_failed_results_zero_quality(self):
        result=ranking_metrics([],{'a':3},10)
        self.assertEqual(result['recall'],0);self.assertEqual(result['mrr'],0);self.assertEqual(result['ndcg'],0)

    def test_duplicate_results_rejected(self):
        with self.assertRaises(ValueError):ranking_metrics(['a','a'],{'a':3},2)

    def test_latency_percentile(self):
        self.assertEqual(percentile([30,10,20],.5),20)
        self.assertEqual(percentile([10],.95),10)
        self.assertIsNone(percentile([],.95))
