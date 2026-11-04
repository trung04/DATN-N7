class Conflict(ValueError):
    pass

class NotFound(ValueError):
    pass

def install_exception_handlers(application):
    from fastapi.responses import JSONResponse
    async def not_found(request, exc):
        return JSONResponse(status_code=404, content={"detail":str(exc)})
    async def conflict(request, exc):
        return JSONResponse(status_code=409, content={"detail":str(exc)})
    async def value_error(request, exc):
        return JSONResponse(status_code=422, content={"detail":str(exc)})
    application.add_exception_handler(NotFound,not_found)
    application.add_exception_handler(Conflict,conflict)
    application.add_exception_handler(ValueError,value_error)
