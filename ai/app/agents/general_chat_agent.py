import ast
import math
import operator
import re
from pydantic import Field
from app.modules.recommendation.schemas import Contract
from app.llm.client import GeminiClient
from app.llm.prompts import GENERAL_SYSTEM

class Answer(Contract):
    answer: str = Field(min_length=1,max_length=10000)

def calculate(expression):
    if len(expression)>100:raise ValueError("Expression too long")
    tree=ast.parse(expression,mode="eval")
    if sum(1 for _ in ast.walk(tree))>32:raise ValueError("Expression too complex")
    operators={ast.Add:operator.add,ast.Sub:operator.sub,ast.Mult:operator.mul,ast.Div:operator.truediv,
               ast.FloorDiv:operator.floordiv,ast.Mod:operator.mod,ast.Pow:operator.pow}
    def visit(node):
        if isinstance(node,ast.Expression):return visit(node.body)
        if isinstance(node,ast.Constant) and type(node.value) in (int,float):value=node.value
        elif isinstance(node,ast.UnaryOp) and isinstance(node.op,(ast.UAdd,ast.USub)):
            value=visit(node.operand)*(1 if isinstance(node.op,ast.UAdd) else -1)
        elif isinstance(node,ast.BinOp) and type(node.op) in operators:
            a,b=visit(node.left),visit(node.right)
            if isinstance(node.op,ast.Pow) and (abs(b)>8 or abs(a)>1e6):raise ValueError("Exponent too large")
            value=operators[type(node.op)](a,b)
        else:raise ValueError("Unsupported expression")
        if not isinstance(value,(int,float)) or not math.isfinite(value) or abs(value)>1e12:raise ValueError("Result out of bounds")
        return value
    return visit(tree)

class GeneralChatAgent:
    def run(self,message,use_llm=False):
        expression=re.sub(r"(?:bằng bao nhiêu|bang bao nhieu|bằng|bang|là bao nhiêu|la bao nhieu|=|\?)","",message,flags=re.I).strip()
        try:
            value=calculate(expression)
            return {"status":"answered","answer":str(value)}
        except (SyntaxError,ValueError,ZeroDivisionError,OverflowError):pass
        if message.casefold().strip(" !.") in ("xin chào","xin chao","chào","hello","hi"):
            return {"status":"answered","answer":"Chào bạn! Mình có thể giúp tìm địa điểm và lập lịch trình du lịch."}
        if use_llm:
            return {"status":"answered","answer":GeminiClient().generate(GENERAL_SYSTEM,message,Answer).answer}
        return {"status":"needs_llm","answer":"Câu hỏi kiến thức tổng quát cần bật use_llm và cấu hình Gemini. Tìm địa điểm và lập lịch vẫn hoạt động không cần LLM."}
