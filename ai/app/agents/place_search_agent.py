from app.workflows.search_workflow import SearchWorkflow

class PlaceSearchAgent:
    def __init__(self,rec):self.workflow=SearchWorkflow(rec)
    def search(self,request):return self.workflow.run(request)
