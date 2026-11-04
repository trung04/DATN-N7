def rank_candidate(search_rank,recommendation_score,rating):
    return 0.5/(1+0.08*(search_rank-1))+0.35*recommendation_score+0.15*((rating or 3)-1)/4
