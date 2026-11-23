"""Create a labeled demo profile and real API signals; never alters place data."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import uuid
from urllib.request import Request, urlopen
from urllib.parse import urlencode


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://localhost:9002')
    parser.add_argument('--city', default='Đà Nẵng')
    parser.add_argument('--output', default='simulated-user-report.json')
    args = parser.parse_args()
    key = os.getenv('RECOMMENDATION_API_KEY') or os.getenv('AI_SERVICE_API_KEY')
    if not key:
        env_file = Path(__file__).resolve().parents[2] / '.env'
        for line in env_file.read_text(encoding='utf-8').splitlines():
            if line.startswith('AI_SERVICE_API_KEY='):
                key = line.split('=', 1)[1].strip().strip('\"\'')
    def api(path, body=None, method=None):
        headers = {'Content-Type': 'application/json'}
        if key:
            headers['X-API-Key'] = key
        request = Request(args.base_url.rstrip('/') + '/api/v1' + path,
                          data=json.dumps(body).encode() if body is not None else None,
                          headers=headers, method=method or ('POST' if body is not None else 'GET'))
        with urlopen(request, timeout=180) as response:
            return json.load(response)

    places, offset = [], 0
    while True:
        page = api('/places?' + urlencode({'limit':100, 'offset':offset,
                                          'city':args.city, 'place_type':'Attraction'}))
        places.extend(page['items']); offset += len(page['items'])
        if offset >= page['total'] or not page['items']:
            break
    places = [p for p in places if p['city'].casefold() == args.city.casefold()
              and p['place_type'] == 'Attraction']
    def affinity(place):
        text = ' '.join([place['name'], place.get('description') or '', *place.get('tags', [])]).casefold()
        return sum(text.count(word) for word in ['biển', 'bãi biển', 'thiên nhiên', 'bán đảo', 'cảnh quan'])
    targets = sorted(places, key=lambda p: (-affinity(p), p['place_id']))[:3]
    if not targets or affinity(targets[0]) == 0:
        raise ValueError('No matching real places to simulate; choose another city')
    user_id = 'demo-beach-' + uuid.uuid4().hex[:10]
    api('/users/' + user_id + '/preferences', {'preferences': []}, 'PUT')
    request = {'user_id': user_id, 'mode': 'personalized_mmr', 'preferences': [],
               'city': args.city, 'place_type': 'Attraction', 'limit': 10, 'mmr_lambda': 1.0}
    before = api('/recommendations', request)
    signals = []
    for index, place in enumerate(targets):
        actions = [('view', {})] * (3 if index == 0 else 1)
        if index < 2:
            actions += [('favorite', {'active': True})]
        if index == 0:
            actions += [('save', {'active': True})]
        for action, extra in actions:
            event = {'event_id': str(uuid.uuid4()), 'place_id': place['place_id'],
                     'action': action, 'occurred_at': datetime.now(timezone.utc).isoformat(), **extra}
            response = api('/users/' + user_id + '/interactions', event)
            assert response['created']
            signals.append({**event, 'place_name': place['name']})
    after = api('/recommendations', request)
    diversified = api('/recommendations', {**request, 'mmr_lambda': .7})
    assert after['diagnostics']['history_available']
    assert after['diagnostics']['history_event_count'] == len(signals)
    report = {'simulation': True, 'user_id': user_id, 'scenario': 'Views + favorites + save, beach/nature interest',
              'request': request, 'signals': signals, 'before': before,
              'after_history': after, 'after_mmr': diversified}
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('USER_ID:', user_id)
    for place in targets:
        print('INTERACTED:', place['name'], '|', place['place_id'])
    print('EVENTS:', len(signals), '| HISTORY PLACES:', after['diagnostics']['history_places_used'])
    for label, result in [('BEFORE', before), ('AFTER HISTORY', after), ('AFTER MMR', diversified)]:
        print(label, '|', result['strategy'])
        for item in result['recommendations'][:5]:
            print(' ', item['name'], '| relevance:', round(item['score'], 4), '| MMR:', round(item['mmr_score'], 4))
    print('REPORT:', str(Path(args.output).resolve()))


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    main()
