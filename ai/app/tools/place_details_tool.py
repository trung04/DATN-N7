import json

def place_details(rec,place_id):
    return json.loads(rec.store.place(place_id)["data"])
