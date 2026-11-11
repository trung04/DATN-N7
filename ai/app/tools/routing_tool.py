def route_matrix(request):
    from app.modules.trip_planner.route_matrix import RouteMatrix
    return RouteMatrix().build([p.model_dump() for p in request.locations],request.transport,request.allow_estimates)
