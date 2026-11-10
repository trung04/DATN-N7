"""Bayesian quality from aggregate place ratings, not review text."""

def bayesian_quality(rating,count,mean,strength):
    n=count if rating is not None else 0
    return ((n*(rating if rating is not None else mean)+strength*mean)/(n+strength)-1)/4
