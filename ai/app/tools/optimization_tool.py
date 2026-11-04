def optimize_trip(rec,request):
    from app.modules.trip_planner.itinerary_optimizer import PlanningEngine
    return PlanningEngine(rec).build(request)
