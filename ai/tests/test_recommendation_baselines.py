import csv
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
from tests import test_recommendation as fixtures
from evaluation.recommendation_benchmark import build_dataset,load_dataset,quality,training_item


class ContentBaselinesTests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed

    def recommend(self,mode,**extra):
        response=self.client.post('/api/v1/recommendations',json={'user_id':'u','mode':mode,**extra})
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def test_tfidf_uses_keywords_without_embedding_rating_or_history(self):
        self.seed(fixtures.place('a',name='Spa',description='spa thư giãn',tags=[],rating=1),
                  fixtures.place('b',name='Bãi biển',description='cát trắng',tags=[],rating=5))
        with patch.object(self.embedding,'embed_text',side_effect=AssertionError('TF-IDF must not use BGE')):
            result=self.recommend('tfidf',preferences=['spa'])
        self.assertEqual(result['recommendations'][0]['place_id'],'a')
        self.assertEqual(result['recommendations'][0]['effective_weights'],{'content':1.})
        self.assertFalse(result['diagnostics']['rating_used'])

    def test_semantic_is_cosine_only_and_shares_filters(self):
        self.seed(fixtures.place('sea',description='biển '*20,rating=1),
                  fixtures.place('mountain',description='núi '*20,rating=5),
                  fixtures.place('other',city='Huế',description='biển '*20))
        result=self.recommend('semantic',preferences=['biển'],city='Đà Nẵng',exclude_place_ids=['mountain'])
        self.assertEqual([p['place_id'] for p in result['recommendations']],['sea'])
        self.assertIsNone(result['recommendations'][0]['mmr_score'])
        self.assertEqual(result['recommendations'][0]['score'],result['recommendations'][0]['content_score'])
        self.assertFalse(result['diagnostics']['history_used'])

    def test_tfidf_no_profile_oov_and_cache_refresh(self):
        self.seed(fixtures.place('a',name='Spa',tags=[]))
        self.assertEqual(self.recommend('tfidf',preferences=[])['total'],0)
        self.assertEqual(self.recommend('tfidf',preferences=['zzzzunknown'])['total'],0)
        self.recommend('tfidf',preferences=['spa'])
        old=self.app.state.recommendation._tfidf_index[0]
        self.seed(fixtures.place('b',name='Núi mới'))
        self.recommend('tfidf',preferences=['núi'])
        self.assertNotEqual(old,self.app.state.recommendation._tfidf_index[0])

    def test_same_case_insensitive_budget_and_category_filters(self):
        self.seed(fixtures.place('a',budget='LOW',categories=['Beach'],family_friendly=True),
                  fixtures.place('b',budget='high',categories=['Beach'],family_friendly=True))
        for mode in ('tfidf','semantic','content_rating'):
            result=self.recommend(mode,preferences=['biển'],budget='low',category='beach',family_friendly=True)
            self.assertEqual([r['place_id'] for r in result['recommendations']],['a'])


class RecommendationBenchmarkTests(unittest.TestCase):
    def test_metrics_and_common_diversity_space(self):
        vectors={'a':np.array([1.,0.]),'b':np.array([0.,1.])}
        m=quality(['a','b'],{'a':3,'b':0},2,vectors)
        self.assertEqual(m['precision'],.5);self.assertEqual(m['recall'],1);self.assertEqual(m['mrr'],1)
        self.assertEqual(m['ndcg'],1);self.assertEqual(m['ild'],.5)

    def test_frozen_history_partition_is_disjoint_and_never_changes_labels(self):
        with tempfile.TemporaryDirectory() as temp:
            source=Path(temp)/'source';source.mkdir();folder=Path(temp)/'dataset'
            catalog=[fixtures.place(str(i),active=True) for i in range(30)]
            query={'query_id':'Q1','query':'biển','filters':{'city':'Đà Nẵng','place_type':'Attraction'},'criteria':[['biển']],'split':'test'}
            (source/'queries.jsonl').write_text(json.dumps(query)+'\n',encoding='utf-8')
            with (source/'judgments.csv').open('w',newline='',encoding='utf-8') as f:
                writer=csv.writer(f);writer.writerow(['query_id','place_id','grade'])
                for p in catalog:writer.writerow(['Q1',p['place_id'],3])
            build_dataset(folder,source,catalog)
            manifest,cases,judgments=load_dataset(folder,catalog)
            self.assertEqual(len(cases),2);self.assertEqual(len(cases[0]['history']),0)
            self.assertTrue(cases[1]['history'])
            for case in cases:
                self.assertFalse({e['place_id'] for e in case['history']} & set(judgments['Q1']))
            self.assertTrue(all(not training_item(pid) for pid in judgments['Q1']))
            catalog[0]['name']='Changed'
            with self.assertRaises(ValueError):load_dataset(folder,catalog)
