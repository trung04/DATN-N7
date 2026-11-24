class PreferenceAnalyzer:
    @staticmethod
    def query(request,store,override=None):
        preferences=request.preferences if request.preferences is not None else store.preferences(request.user_id)
        return (override or request.query or ". ".join(preferences) or "tham quan, văn hóa, thiên nhiên và ẩm thực")[:2000]
