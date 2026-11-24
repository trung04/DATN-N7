from app.workflows.trip_planning_workflow import TripPlanningWorkflow

class TripPlannerAgent:
    def __init__(self,rec):self.workflow=TripPlanningWorkflow(rec)
    def run(self,request,understanding=None):return self.workflow.chat(request,understanding=understanding)
