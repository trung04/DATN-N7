from app.database.repositories.trip_repository import TripRepository
from app.modules.trip_planner.itinerary_optimizer import PlanningEngine

class ReplanningWorkflow:
    def __init__(self,rec):
        self.repo=TripRepository(rec.store)
        self.engine=PlanningEngine(rec)
    def run(self,trip_id,day,edit):
        stored=self.repo.get(trip_id,edit.user_id)
        request,result=self.engine.edit(stored,day,edit)
        return self.repo.update(trip_id,edit.user_id,edit.expected_version,request,result)
