import unittest
import numpy as np
from app.modules.recommendation.personalized import guarded_mmr,relevance_value,relevance_safe,rotate_recommendations
from app.modules.recommendation.schemas import RecommendationRequest


class GuardedMMRTests(unittest.TestCase):
    def test_rotation_cannot_replace_more_relevant_items_with_fresh_subset(self):
        items=[{'place_id':str(i),'intent_score':1-i*.035,'score':1-i*.01} for i in range(7)]
        vectors={p['place_id']:np.array([1.,0.]) for p in items}
        request=RecommendationRequest(user_id='u',limit=5,mmr_relevance_tolerance=.02)
        baseline=guarded_mmr(items,vectors,5,request.mmr_lambda,.02)
        recent=[{'recommendations':baseline}]
        chosen,diagnostics=rotate_recommendations(items,baseline,vectors,request,recent)
        self.assertTrue(relevance_safe(items,chosen,.02))
        self.assertTrue(diagnostics.get('rotation_relevance_guard_blocked'))
        self.assertEqual([p['place_id'] for p in chosen],[p['place_id'] for p in baseline])
    def test_diversifies_near_relevant_items_without_promoting_irrelevant_high_rating(self):
        items=[{'place_id':p,'intent_score':r,'score':s} for p,r,s in [('a',.9,.9),('b',.89,.89),('c',.88,.88),('wrong',.1,1.)]]
        vectors={'a':np.array([1.,0.]),'b':np.array([1.,0.]),'c':np.array([0.,1.]),'wrong':np.array([-1.,0.])}
        chosen=guarded_mmr(items,vectors,2,.3,.02)
        self.assertEqual([p['place_id'] for p in chosen],['a','c'])

    def test_zero_tolerance_preserves_semantic_order(self):
        items=[{'place_id':str(i),'intent_score':1-i*.1,'score':.5+i*.1} for i in range(5)]
        vectors={p['place_id']:np.array([1.,0.]) for p in items}
        result=guarded_mmr(items,vectors,3,.1,0)
        self.assertEqual([p['place_id'] for p in result],['0','1','2'])

    def test_rotation_floor_is_respected_and_can_return_fewer_novel_items(self):
        anchor={'place_id':'a','intent_score':.9,'score':.8}
        wrong={'place_id':'wrong','intent_score':.2,'score':1.}
        vectors={'a':np.array([1.,0.]),'wrong':np.array([0.,1.])}
        result=guarded_mmr([wrong],vectors,2,.5,.02,initial=[anchor],floor=.85)
        self.assertEqual([p['place_id'] for p in result],['a'])

    def test_per_position_relevance_drift_is_bounded(self):
        rng=np.random.default_rng(7)
        for _ in range(10):
            values=rng.random(25)
            items=[{'place_id':str(i),'intent_score':float(v*2-1),'score':float(rng.random())} for i,v in enumerate(values)]
            vectors={p['place_id']:np.array([1.,0.]) for p in items}
            result=guarded_mmr(items,vectors,10,.5,.02)
            remaining=list(items)
            for p in result:
                self.assertGreaterEqual(relevance_value(p)+.0200001,max(relevance_value(q) for q in remaining))
                remaining=[q for q in remaining if q['place_id']!=p['place_id']]
