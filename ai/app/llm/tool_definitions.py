"""JSON-schema function declarations for the exact tools accepted by ToolRegistry."""
from app.tools.tool_registry import CONTRACTS

def function_declarations():
    return [{"name":name,"description":f"Execute validated {name} against the configured travel services",
             "parametersJsonSchema":schema.model_json_schema()} for name,schema in CONTRACTS.items()]
