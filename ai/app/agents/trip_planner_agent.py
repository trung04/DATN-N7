from app.workflows.trip_planning_workflow import TripPlanningWorkflow

class TripPlannerAgent:
    def __init__(self,rec):self.workflow=TripPlanningWorkflow(rec)
    def run(self,request):return self.workflow.chat(request)
