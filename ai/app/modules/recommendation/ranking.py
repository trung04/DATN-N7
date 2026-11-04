"""Explainable heuristic scores; these weights are not trained probabilities."""
def bayesian_quality(rating,count,mean,strength):
    n=count if rating is not None else 0
    return ((n*(rating if rating is not None else mean)+strength*mean)/(n+strength)-1)/4
def score_candidate(content,quality,distance,collaborative,confidence,config,repeat_count=0):
    parts={'quality':(quality,config.quality_weight)}
    if content is not None:parts['content']=((content+1)/2,config.content_weight*confidence)
    if distance is not None:parts['distance']=(distance,config.distance_weight)
    if collaborative is not None:parts['collaborative']=(collaborative,config.collaborative_weight)
    total=sum(w for _,w in parts.values());weights={k:w/total for k,(_,w) in parts.items()}
    base=sum(parts[k][0]*w for k,w in weights.items())
    penalty=config.repeat_penalty*min(repeat_count,3)/3
    return max(0,base-penalty),weights,penalty
