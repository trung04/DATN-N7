from app.tools.tool_registry import ToolRegistry

class SearchWorkflow:
    def __init__(self,rec):self.tools=ToolRegistry(rec)
    def run(self,request):
        return self.tools.execute("semantic_search",{"request":request.model_dump(mode="json",exclude_unset=True)})
