"""Named-vector Qdrant adapter; never initializes a second embedding model."""
import uuid
from qdrant_client import models


class PlaceVectorRepository:
    def __init__(self, qdrant_client, embedding_service, collection_name, vector_name="text_dense"):
        self.embedding = embedding_service
        self.collection = collection_name
        self.qdrant = qdrant_client
        self.vector_name = vector_name
        self._ready = False

    @staticmethod
    def point_id(place_id):
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"tourism-place:{place_id}"))

    def ensure_collection(self):
        if self._ready:return
        if not self.qdrant.collection_exists(self.collection):
            self.qdrant.create_collection(collection_name=self.collection, vectors_config={
                self.vector_name: models.VectorParams(size=self.embedding.dimensions, distance=models.Distance.COSINE)})
        info = self.qdrant.get_collection(self.collection)
        config = info.config.params.vectors
        if (not isinstance(config, dict) or self.vector_name not in config or
                config[self.vector_name].size != self.embedding.dimensions or
                config[self.vector_name].distance != models.Distance.COSINE):
            raise ValueError("Collection recommendation phải có named vector đúng số chiều và COSINE; dùng collection mới")
        indexes={"place_id":models.PayloadSchemaType.KEYWORD,"city":models.PayloadSchemaType.KEYWORD,
                 "place_type":models.PayloadSchemaType.KEYWORD,"categories":models.PayloadSchemaType.KEYWORD,
                 "tags":models.PayloadSchemaType.KEYWORD,"model":models.PayloadSchemaType.KEYWORD,
                 "category_keys":models.PayloadSchemaType.KEYWORD,"budget_key":models.PayloadSchemaType.KEYWORD,
                 "family_friendly":models.PayloadSchemaType.BOOL,"location":models.PayloadSchemaType.GEO,
                 "active":models.PayloadSchemaType.BOOL,"rating":models.PayloadSchemaType.FLOAT}
        for key,kind in indexes.items():
            existing=info.payload_schema.get(key)
            if existing and existing.data_type!=kind:
                self.qdrant.delete_payload_index(self.collection,key,wait=True)
            if not existing or existing.data_type!=kind:
                self.qdrant.create_payload_index(self.collection,key,kind,wait=True)
        self._ready=True

    def upsert(self, place, vector, model):
        self.ensure_collection()
        payload={key:place.get(key) for key in ("name","description","categories","amenities","tags",
                  "rating","review_count","budget","family_friendly","active")}
        payload['category_keys']=[x.casefold() for x in place.get('categories',[])]
        payload['budget_key']=place['budget'].casefold() if place.get('budget') else None
        payload.update({
                "place_id": place["place_id"], "city": place["city"].casefold(),
                "place_type": place["place_type"], "model": model})
        if place.get("latitude") is not None:
            payload['location']={'lat':place['latitude'],'lon':place['longitude']}
        self.qdrant.upsert(collection_name=self.collection, wait=True, points=[models.PointStruct(
            id=self.point_id(place["place_id"]), vector={self.vector_name: vector}, payload=payload)])

    def candidates(self, vector, request, model, limit):
        conditions = [models.FieldCondition(key="model", match=models.MatchValue(value=model))]
        conditions.append(models.FieldCondition(key="active",match=models.MatchValue(value=True)))
        if request.city:
            conditions.append(models.FieldCondition(key="city", match=models.MatchValue(value=request.city.casefold())))
        if request.place_type:
            conditions.append(models.FieldCondition(key="place_type", match=models.MatchValue(value=request.place_type)))
        if request.family_friendly is not None:
            conditions.append(models.FieldCondition(key='family_friendly',match=models.MatchValue(value=request.family_friendly)))
        if request.category:
            conditions.append(models.FieldCondition(key='category_keys',match=models.MatchValue(value=request.category.casefold())))
        if request.budget:
            conditions.append(models.FieldCondition(key='budget_key',match=models.MatchValue(value=request.budget.casefold())))
        if request.radius_km is not None:
            conditions.append(models.FieldCondition(key='location',geo_radius=models.GeoRadius(
                center=models.GeoPoint(lat=request.latitude,lon=request.longitude),radius=request.radius_km*1000)))
        excluded=[models.FieldCondition(key='place_id',match=models.MatchAny(any=request.exclude_place_ids))] if request.exclude_place_ids else None
        response = self.qdrant.query_points(collection_name=self.collection, query=vector.tolist(),
            using=self.vector_name, query_filter=models.Filter(must=conditions,must_not=excluded), limit=limit, with_payload=True)
        return [str(p.payload["place_id"]) for p in response.points if p.payload and "place_id" in p.payload]
