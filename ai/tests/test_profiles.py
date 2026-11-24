import json
import unittest
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
from types import SimpleNamespace
import numpy as np
from tests import test_recommendation as fixtures
place=fixtures.place
from app.modules.recommendation.profiles import InterestProfile
from app.modules.recommendation.place_document import place_document
from app.core.config import RankingConfig

class ProfileTests(unittest.TestCase):
    def test_distinct_tastes_do_not_collapse_to_average(self):
        profile=InterestProfile([np.array([1.,0]),np.array([0.,1])],[.5,.5])
        self.assertEqual(profile.score(np.array([1.,0])),1)
        self.assertEqual(profile.score(np.array([0.,1])),1)
        self.assertLess(profile.score(np.array([.707,.707])),1)

    def test_query_takes_priority(self):
        p=InterestProfile([np.array([1.,0])],[1],np.array([0.,1]))
        self.assertGreater(p.score(np.array([0.,1])),p.score(np.array([1.,0])))

    def test_one_weak_interest_does_not_outvote_declared_preference(self):
        p=InterestProfile([np.array([1.,0]),np.array([0.,1])],[.95,.05])
        self.assertGreater(p.score(np.array([1.,0])),p.score(np.array([0.,1])))


    def test_reviews_cannot_establish_facilities(self):
        text=place_document(place('p',review_summary='Hồ bơi rất bẩn',description='Bảo tàng văn hóa',amenities=[]))
        self.assertNotIn('hồ bơi',text.casefold());self.assertIn('Bảo tàng',text)

class ExplicitProfileAPITests(unittest.TestCase):
    setUp=fixtures.APITests.setUp
    tearDown=fixtures.APITests.tearDown
    seed=fixtures.APITests.seed
    recommend=fixtures.APITests.recommend

    def test_multiple_interests_and_model_version(self):
        self.seed(place('sea'),place('mountain',tags=['núi']))
        result=self.recommend(preferences=['biển','núi'])
        self.assertEqual(result['diagnostics']['interest_groups'],2)
        self.assertFalse(result['diagnostics']['score_is_probability'])
        self.assertTrue(result['model_version'].startswith('content-rating-v1-'))
        for item in result['recommendations']:
            self.assertAlmostEqual(sum(item['effective_weights'].values()),1)


    def test_unapproved_review_is_audited_without_affecting_vector(self):
        self.seed(place('a'));svc=self.app.state.recommendation
        before=svc.store.place('a');calls=self.embedding.calls
        r=self.client.post('/api/v1/reviews/batch',json={'reviews':[{'review_id':'bad','place_id':'a','rating':1,
            'text':'Cuong','use_for_embedding':False,'occurred_at':'2026-01-01T00:00:00+07:00'}]})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(before['vector'],svc.store.place('a')['vector'])
        self.assertEqual(before['content_hash'],svc.store.place('a')['content_hash'])
        self.assertEqual(self.embedding.calls,calls)
        self.assertEqual(svc.status()['pending_index'],0)
        self.assertFalse(svc.store.reviews('a')[0]['use_for_embedding'])

    def test_approved_review_requires_clean_text(self):
        self.seed(place('a'))
        r=self.client.post('/api/v1/reviews/batch',json={'reviews':[{'review_id':'x','place_id':'a','rating':5,
            'text':'raw','use_for_embedding':True,'occurred_at':'2026-01-01T00:00:00+07:00'}]})
        self.assertEqual(r.status_code,422)

    def test_factual_payload_and_index(self):
        self.seed(place('opaque-id',amenities=['Hồ bơi']))
        point=self.qdrant.scroll('test_places',with_payload=True)[0][0]
        self.assertEqual(point.payload['place_id'],'opaque-id')
        self.assertEqual(point.payload['amenities'],['Hồ bơi'])
        self.assertNotIn('review_summary',point.payload)
        self.assertIn('facts-v2',point.payload['model'])


    def test_all_profile_groups_query_qdrant_and_outage_falls_back(self):
        self.seed(place('a'),place('b',tags=['núi']))
        svc=self.app.state.recommendation
        with patch.object(svc.content,'candidates',wraps=svc.content.candidates) as get:
            self.recommend(preferences=['biển','núi']);self.assertEqual(get.call_count,2)
        with patch.object(svc.content,'candidates',side_effect=RuntimeError('offline')):
            r=self.recommend(preferences=['biển','núi'])
        self.assertEqual(r['retrieval'],'local_exact');self.assertEqual(r['total'],2)


    def test_retrieval_applies_category_budget_family_and_radius(self):
        from app.modules.recommendation.schemas import RecommendationRequest
        self.seed(place('a',categories=['Biển'],budget='Vừa',family_friendly=True),
                  place('b',categories=['Biển'],budget='Cao',family_friendly=True),
                  place('c',categories=['Biển'],budget='Vừa',family_friendly=True,latitude=20),
                  place('d',categories=['Núi'],budget='Vừa',family_friendly=True),
                  place('e',categories=['Biển'],budget='Vừa',family_friendly=False))
        req=RecommendationRequest(user_id='u',category='BIỂN',budget='vừa',family_friendly=True,
                                  latitude=16.05,longitude=108.2,radius_km=5)
        svc=self.app.state.recommendation
        ids=svc.content.candidates(np.array(self.embedding.embed_text('biển')),req,svc.model,100)
        self.assertEqual(ids,['a'])
        req=req.model_copy(update={'exclude_place_ids':['a']})
        self.assertEqual(svc.content.candidates(np.array(self.embedding.embed_text('biển')),req,svc.model,100),[])


    def test_corrupt_factual_text_is_rejected_before_embedding(self):
        calls=self.embedding.calls
        for text in ['Khách sạn \ufffd','khÃ¡ch sạn']:
            r=self.client.post('/api/v1/embeddings/place',json=place('broken',description=text))
            self.assertEqual(r.status_code,422,r.text)
        self.assertEqual(self.embedding.calls,calls)
        self.assertEqual(len(self.app.state.recommendation.store.places()),0)

    def test_service_only_records_are_separate_from_visitable_places(self):
        self.seed(place('operator',categories=['Nhà điều hành du lịch']),
                  place('museum',categories=['Bảo tàng']),
                  place('mixed',categories=['Điểm thu hút khách du lịch','Đại lý du lịch']),
                  place('unknown',categories=[]))
        result=self.recommend()
        ids={p['place_id'] for p in result['recommendations']}
        self.assertNotIn('operator',ids)
        self.assertEqual(ids,{'museum','mixed','unknown'})
        self.assertEqual(result['diagnostics']['service_only_excluded'],1)
        ids={p['place_id'] for p in self.recommend(include_service_places=True)['recommendations']}
        self.assertIn('operator',ids)
        self.assertEqual([p['place_id'] for p in self.recommend(category='nhà điều hành du lịch')['recommendations']],['operator'])

    def test_same_name_is_shown_once_without_merging_source_records(self):
        self.seed(place('a',name='Bãi biển Mỹ Khê'),place('b',name='bãi biển  mỹ khê',latitude=16.07),
                  place('c',name='Bãi biển Non Nước'))
        result=self.recommend()
        self.assertEqual(result['total'],2)
        self.assertEqual(result['diagnostics']['same_name_suppressed'],1)
        self.assertEqual(len(self.app.state.recommendation.store.places()),3)



class ImportTests(unittest.TestCase):
    def test_header_trim_and_explicit_review_flags(self):
        from scripts import import_excel
        class Sheet:
            def __init__(self,title,rows):self.title=title;self.rows=rows
            def iter_rows(self,values_only=True):return iter(self.rows)
        class Book(dict):
            epoch=datetime(1899,12,30)
            def close(self):pass
        book=Book({'Địa điểm chung':Sheet('Địa điểm chung',[
            ['Mã địa điểm','Tên địa điểm','Loại địa điểm','Thành phố','Địa chỉ'],['p','Biển','Attraction','Đà Nẵng',None]]),
            'Đánh giá (Reviews)':Sheet('Đánh giá (Reviews)',[
            ['Mã đánh giá','Mã địa điểm','Điểm đánh giá','Nội dung đánh giá ','Ngày đánh giá','Nội dung chuẩn hóa (Embedding)','Dùng cho embedding'],
            ['r1','p',5,'raw1','2026-01-01T00:00:00+07:00','clean',True],
            ['r2','p',1,'raw2','2026-01-01T00:00:00+07:00',None,False]])})
        with patch.object(import_excel,'load_workbook',return_value=book):
            places,reviews,errors=import_excel.load_data('test.xlsx')
        self.assertEqual(errors,[]);self.assertEqual(len(reviews),2)
        self.assertTrue(reviews[0].use_for_embedding)
        self.assertFalse(reviews[1].use_for_embedding)
        self.assertIsNone(reviews[1].normalized_text)
