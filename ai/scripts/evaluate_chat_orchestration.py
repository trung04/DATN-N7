"""Live Gemini, isolated business tools. Never copies credentials to reports.

Run inside the AI container: python scripts/evaluate_chat_orchestration.py --label baseline
Holdout is only evaluated explicitly with --split holdout after prompt selection.
"""
import argparse
import copy
import io
import json
import logging
import hashlib
import statistics
import sys
import time
from urllib.error import HTTPError
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests.test_chat_acceptance_30 import ChatAcceptance30
from app.agents.chat_understanding import Understanding
from app.llm import client as llm_client
from app.core.config import env
from app.agents.chat_understanding import ORCHESTRATION_SYSTEM
from app.tools.tool_registry import ToolRegistry
from app.memory.conversation_store import ConversationStore
from app.modules.semantic_search.text_utils import folded

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'chat-orchestration'
LAST_REQUEST = 0.0


class FixedDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(2026, 11, 24, 10, tzinfo=tz or timezone.utc)


def evaluate_case(case):
    fixture = ChatAcceptance30('test_TC01')
    fixture.LIVE = True
    fixture.setUp()
    records = []
    try:
        fixture.populate()
        cid = fixture.memory(copy.deepcopy(case.get('context', {})))
        for step in case['steps']:
            observed, usage, provider_failures, tool_trace = [], [], [], []
            fixture.calls=[]
            original_generate = llm_client.GeminiClient.generate
            original_open = llm_client.urlopen
            original_tool=ToolRegistry.execute

            def trace_tool(registry,name,args):
                tool_trace.append({'name':name,'args':copy.deepcopy(args)})
                return original_tool(registry,name,args)

            def generate(client, system, message, schema):
                result = original_generate(client, system, message, schema)
                if isinstance(result, Understanding):
                    observed.append(result.model_dump(mode='json', exclude_none=True))
                return result

            def urlopen(*args, **kwargs):
                global LAST_REQUEST
                delay=max(0,6-(time.monotonic()-LAST_REQUEST))
                if delay: time.sleep(delay)
                LAST_REQUEST=time.monotonic()
                network_started=time.perf_counter()
                try: response = original_open(*args, **kwargs)
                except HTTPError as exc:
                    provider_failures.append({'http_status':exc.code})
                    raise
                with response:
                    raw = response.read(1_000_001)
                body = json.loads(raw)
                usage.append({**body.get('usageMetadata', {}),'request_latency_ms':round((time.perf_counter()-network_started)*1000,2)})
                return io.BytesIO(raw)

            started = time.perf_counter()
            error = None
            try:
                with patch.object(llm_client.GeminiClient, 'generate', generate), patch.object(llm_client, 'urlopen', urlopen), patch.object(ToolRegistry,'execute',trace_tool), patch('app.modules.trip_planner.input_gate.datetime', FixedDatetime), patch('app.agents.chat_understanding.datetime', FixedDatetime):
                    result = fixture.speak(step['input'], cid=cid)
                cid = result.get('conversation_id') or cid
            except Exception as exc:
                error = str(exc)[:1000]
                result = {}
            latency = (time.perf_counter() - started) * 1000
            state = ConversationStore(fixture.app.state.recommendation.store).get(cid, 'u')['draft']
            parsed = observed[-1] if observed else {}
            intent = result.get('intent') or parsed.get('intent') or ('general_chat' if result.get('result', {}).get('answer') else None)
            answer = result.get('message') or result.get('result', {}).get('answer', '')
            fields = parsed.get('fields', {})
            checks = {}
            expected = step.get('expect', {})
            if 'intents' in expected: checks['intent'] = intent in expected['intents']
            actual = state if intent in ('trip_planning','replanning') else {**fields,**state}
            if 'fields' in expected:
                checks['extraction'] = all(actual.get(k) == v for k, v in expected['fields'].items())
            if 'preferences' in expected:
                checks['extraction'] = checks.get('extraction', True) and all(any(folded(p) in folded(v) for v in actual.get('preferences', [])) for p in expected['preferences'])
            if 'absent_preferences' in expected:
                checks['extraction'] = checks.get('extraction', True) and not any(folded(p) in folded(v) for p in expected['absent_preferences'] for v in actual.get('preferences', []))
            if 'retain' in expected: checks['context'] = all(state.get(k) == v for k, v in expected['retain'].items())
            calls = list(fixture.calls)
            checks['tool'] = not any(c in calls for c in expected.get('forbid_tools', []))
            if expected.get('any_tool'): checks['tool'] &= any(c in calls for c in expected['any_tool'])
            if expected.get('any_tool'): checks['tool'] &= all(c in expected['any_tool'] for c in calls)
            if expected.get('no_tools'): checks['tool'] &= not calls
            if expected.get('clarify'): checks['clarification'] = bool(answer) and not calls
            # These are transparent automated proxies, not an LLM judge or human rating.
            checks['response_quality_proxy'] = bool(answer or result.get('trip') or result.get('result', {}).get('results')) and len(answer) <= 1000
            checks['hallucination_proxy'] = not any(x in answer for x in ('GEMINI_API_KEY=', 'ORS_API_KEY=', 'systemInstruction', 'Traceback'))
            if expected.get('answer_contains'):
                checks['response_content'] = all(folded(s) in folded(answer) for s in expected['answer_contains'])
            if expected.get('no_date'): checks['extraction'] = not actual.get('start_date')
            if expected.get('no_fields'):checks['extraction']=checks.get('extraction',True) and all(actual.get(k) is None for k in expected['no_fields'])
            if expected.get('negative_interest'):checks['extraction']=checks.get('extraction',True) and bool(actual.get('excluded_preferences'))
            records.append({'input': step['input'], 'expect': expected, 'intent': intent, 'entities': fields,'understanding':parsed,
                'state': state, 'tool_calls': calls, 'tool_trace':tool_trace,'response': answer, 'llm_calls': len(usage),
                'usage': usage, 'provider_failures':provider_failures, 'latency_ms': round(latency, 2), 'checks': checks, 'error': error,
                'passed': not error and all(checks.values())})
    finally:
        fixture.tearDown()
    return {'id': case['id'], 'split': case['split'], 'passed': all(r['passed'] for r in records), 'turns': records}


def summary(results):
    turns = [t for r in results for t in r['turns']]
    metrics = {}
    for key in ('intent', 'extraction', 'tool', 'context', 'hallucination_proxy', 'response_quality_proxy'):
        selected = [t['checks'][key] for t in turns if key in t['checks'] and not t['error']]
        metrics[key] = {'correct': sum(selected), 'total': len(selected), 'accuracy': round(sum(selected)/len(selected), 4) if selected else None}
    usage = [u for t in turns for u in t['usage']]
    return {'cases_passed': sum(r['passed'] for r in results), 'cases_total': len(results),
        'turns': len(turns), 'provider_or_execution_errors': sum(bool(t['error']) for t in turns), 'metrics': metrics,
        'tokens': {k: sum(u.get(k, 0) for u in usage) for k in ('promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount', 'totalTokenCount')},
        'llm_calls': len(usage), 'latency_mean_ms': round(statistics.mean(t['latency_ms'] for t in turns), 2),
        'generation_latency_mean_ms':round(statistics.mean(u['request_latency_ms'] for u in usage if 'request_latency_ms' in u),2) if any('request_latency_ms' in u for u in usage) else None,
        'latency_p95_ms': round(sorted(t['latency_ms'] for t in turns)[max(0, int(.95*len(turns))-1)], 2)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--label', required=True)
    parser.add_argument('--split', choices=['development', 'holdout'], default='development')
    parser.add_argument('--ids', nargs='*')
    args = parser.parse_args()
    if args.split=='holdout' and args.label!='final':parser.error('Holdout can only run after selection with --label final.')
    logging.disable(logging.WARNING)
    ROOT.mkdir(parents=True,exist_ok=True)
    cases = json.loads((Path(__file__).resolve().parents[1]/'tests/fixtures/chat_orchestration_cases.json').read_text(encoding='utf-8'))
    cases = [c for c in cases if c['split'] == args.split and (not args.ids or c['id'] in args.ids)]
    output = ROOT/(args.label + '.' + args.split + '.json')
    results = []
    for case in cases:
        result = evaluate_case(case)
        results.append(result)
        output.write_text(json.dumps({'fixed_date':'2026-11-24','timezone':'Asia/Ho_Chi_Minh','model':env('GEMINI_MODEL'),
            'prompt_sha256':hashlib.sha256(ORCHESTRATION_SYSTEM.encode()).hexdigest(),
            'label': args.label, 'results': results, 'summary': summary(results)}, ensure_ascii=False, indent=2), encoding='utf-8')
        print(case['id'], 'PASS' if result['passed'] else 'FAIL', flush=True)
    print(json.dumps(summary(results)), flush=True)


if __name__ == '__main__': main()
