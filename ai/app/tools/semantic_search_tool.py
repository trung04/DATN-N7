def semantic_search(rec,request):
    from app.modules.semantic_search.text_search import PlaceSearchService
    return PlaceSearchService(rec).search(request)
