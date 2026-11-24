import json

def merge_context(conversation,explicit,stored=None):
    base=json.loads(stored["request"]) if stored else {}
    return {**base,**conversation["draft"],**explicit}
