"""Comparable dimensionless travel objective, independent of recommendation priority."""


def references(matrix, count):
    def scale(name):
        return max([v for row in matrix[name] for v in row if v is not None]+[1.])*max(1,count-1)
    return scale('kilometers'),scale('minutes')


def travel_cost(schedule, request, matrix, count):
    d_ref,t_ref=references(matrix,count)
    total=request.distance_weight+request.duration_weight
    return (request.distance_weight*schedule['total_distance_km']/d_ref
            +request.duration_weight*(schedule.get('total_travel_seconds',schedule['total_travel_minutes']*60)/60)/t_ref)/total


def improve_2opt(route, schedule, evaluate, request, matrix, count):
    before=travel_cost(schedule,request,matrix,count)
    for _ in range(10):
        improved=False
        for left in range(len(route)):
            for right in range(left+2,len(route)+1):
                trial=route[:left]+list(reversed(route[left:right]))+route[right:]
                candidate=evaluate(trial)
                # Full resimulation includes every reversed directed edge, windows, rests and fixed anchors.
                if candidate and travel_cost(candidate,request,matrix,count)<travel_cost(schedule,request,matrix,count)-1e-10:
                    route,schedule,improved=trial,candidate,True
        if not improved:break
    return route,schedule,before,travel_cost(schedule,request,matrix,count)
