"""Source-only case extraction and model recheck, before audio submission.

The second pass is a model source recheck, not a guarantee of factual accuracy.
"""
import hashlib
import json
import os
import re
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

VERSION = 'episode-facts-v1'
START = '【本集自動抽取的情節紀錄】'
SCAN_START = '【掃描影像來源開場提醒】'
SCAN_WARNING = '本集由 AI 依原書掃描影像製作，文字辨識與情節轉述可能有誤；涉及人物、事件與細節，請以原書為準。'
MAX_CARD_CHARS = 2600
MAX_CHAT_CHARS = 3500

EXTRACT_PROMPT = '''請只根據已勾選的本集原始內容，抽取原書實際記載的故事、案例或情節，不写節目、不生成音訊。不受先前聊天內容影響。
分清誰提出、誰執行、誰協助；保留事件先後及影響理解的補充、轉折、否定、更正。作者的評論、例句、假設、人物猜測與實際事件必須區分。不能用常識補動機、授權、心理或因果。小說情節仍按來源記錄，不當現實史實。沒有案例就回傳空cases與原因，勿硬造。
只輸出JSON，不加前言、Markdown或追問。kind必須是extracted。cases為陣列，每項欄位：title字串、participants字串陣列（角色與分工）、events字串陣列（按來源順序）、essential_context字串陣列、author_commentary字串陣列、evidence陣列（每項quote為逐字原句，location為可核對位置；頁碼不明就明說，不猜）。頂層另有uncertainties字串陣列、no_cases_reason字串。精簡到整份JSON不超過2400字元，優先保留有助本集理解的關鍵案例及角色／因果，不濃縮掉必要澄清；無法完整記錄的範圍列為uncertainties。'''

RECHECK_PROMPT = '''請重新讀取唯一勾選的原始內容，逐項回查下方抽取草稿，勿把草稿或先前聊天當成證據。不寫節目、不生成音訊。
檢查角色分工、先後、完整上下文及引文是否逐字；特別分清作者舉例／評論／假設與人物實際對話。不把「這類人會問」改成「此人接著問」，不將猜測改為事件。補回影響理解的否定、更正、轉折；刪除來源不支持的行動／動機／授權／心理／因果。不能核實的内容不放入事件，列為uncertainties。沒有案例，cases留空並說明。
回傳修正後完整JSON，沿用原欄位，kind必須改為reviewed。只輸出JSON，整份不超過2400字元。這是來源回查，不是語音品質驗收。
抽取草稿：
'''

class EpisodeFactsError(RuntimeError):
    pass

def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))

def sha(value):
    return hashlib.sha256(value).hexdigest()

def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.facts-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)

def strings(value, label):
    if not isinstance(value, list) or any(not isinstance(s, str) or not s.strip() for s in value):
        raise EpisodeFactsError('Invalid string list: '+label)

def validate(card, kind):
    if not isinstance(card, dict) or card.get('kind') != kind:
        raise EpisodeFactsError('Missing correct response kind: '+kind)
    if not isinstance(card.get('cases'), list):
        raise EpisodeFactsError('Missing cases array')
    strings(card.get('uncertainties'), 'uncertainties')
    if not isinstance(card.get('no_cases_reason'), str):
        raise EpisodeFactsError('Missing no_cases_reason')
    if not card['cases'] and not card['no_cases_reason'].strip():
        raise EpisodeFactsError('Empty cases without explanation')
    for case in card['cases']:
        if not isinstance(case, dict) or not isinstance(case.get('title'), str) or not case['title'].strip():
            raise EpisodeFactsError('Missing case title')
        for label in ['participants', 'events', 'essential_context', 'author_commentary']:
            strings(case.get(label), label)
        if not case['events']:
            raise EpisodeFactsError('Case has no events')
        evidence = case.get('evidence')
        if not isinstance(evidence, list) or not evidence:
            raise EpisodeFactsError('Case lacks source evidence')
        for item in evidence:
            if not isinstance(item, dict) or any(not isinstance(item.get(k), str) or not item[k].strip() for k in ['quote', 'location']):
                raise EpisodeFactsError('Invalid source quotation')
    if len(dumps(card)) > MAX_CARD_CHARS:
        raise EpisodeFactsError('Case record exceeds bounded prompt budget; no silent truncation')
    return card

def parse_response(raw, kind):
    # Input may be echoed with normalized whitespace. Select only the requested
    # response kind; the verification input is extracted, never reviewed.
    decoder = json.JSONDecoder()
    candidates = []
    for match in re.finditer(r'\{', raw):
        try:
            value, _ = decoder.raw_decode(raw[match.start():])
            if isinstance(value, dict) and value.get('kind') == kind:
                candidates.append(value)
        except ValueError:
            pass
    if not candidates:
        raise EpisodeFactsError('No structured model response: '+kind)
    return validate(candidates[-1], kind)

def base_prompt(prompt):
    return prompt.split(START, 1)[0].split(SCAN_START, 1)[0].rstrip()

def source_selected(checked, filename):
    # checked_sources includes UI icon labels surrounding the filename.
    if len(checked) != 1:
        return False
    title = checked[0].strip()
    icons = r'(?:drive_pdf|picture_as_pdf|description|article|more_vert)'
    title = re.sub(r'^(?:'+icons+r'\s*)+', '', title)
    title = re.sub(r'(?:\s*'+icons+r')+$', '', title)
    return title.strip() == filename

def compose(base, card):
    return base + '\n\n' + START + '''
以下為本集內容經自動抽取並回查來源的幕後參考。請再依原始來源核對，來源優先；保留分工、事件順序與必要上下文，不把作者評論／例句／假設說成實際行動或對話，不自行補寫動機、心理、授權或因果。未明確的事項保留不確定，不填空。節目中不要提及抽取或回查流程。
''' + dumps(card)

async def prepare_notebook_episode_facts(nb, book, ep):
    """Prepare/reuse one episode record; write prompt only after source recheck."""
    name = f'EP{ep:02d}'
    prompts_path = book.dir/'audio_prompts.json'
    aps = json.loads(prompts_path.read_text(encoding='utf-8'))
    base = base_prompt(aps[name])
    sources = sorted((book.dir/'sources').glob(f'ep{ep:02d}_content.*'))
    sources = [f for f in sources if f.suffix in ['.pdf', '.txt']]
    if len(sources) != 1:
        raise EpisodeFactsError('Episode content source missing or ambiguous: '+name)
    source = sources[0]
    identity = dict(version=VERSION, source=source.name, source_sha256=sha(source.read_bytes()), base_sha256=sha(base.encode('utf-8')))
    key = sha(dumps(identity).encode('utf-8'))
    root = book.dir/'episode_facts'/name/key
    receipt_path = root/'receipt.json'
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
        card = validate(receipt['card'], 'reviewed')
        prompt = compose(base, card)
        if receipt.get('identity') != identity or receipt.get('prompt_sha256') != sha(prompt.encode('utf-8')):
            raise EpisodeFactsError('Cached case record mismatch')
    else:
        previous = await nb.checked_sources()
        root.mkdir(parents=True, exist_ok=True)
        try:
            await nb.select_sources([source.name])
            checked = await nb.checked_sources()
            if not source_selected(checked, source.name):
                raise EpisodeFactsError('Source-only selection failed: '+repr(checked))
            extracted_path = root/'extracted.json'
            if extracted_path.exists():
                extracted = validate(json.loads(extracted_path.read_text(encoding='utf-8')), 'extracted')
            else:
                atomic_write(root/'extract_prompt.txt', EXTRACT_PROMPT)
                raw = await nb.ask_chat_patient(EXTRACT_PROMPT, 'FACTS_EXTRACT_'+uuid.uuid4().hex, timeout=600)
                atomic_write(root/'extract_raw.txt', raw)
                extracted = parse_response(raw, 'extracted')
                atomic_write(extracted_path, dumps(extracted))
            question = RECHECK_PROMPT+dumps(extracted)
            if len(question)+60 > MAX_CHAT_CHARS:
                raise EpisodeFactsError('Recheck question exceeds chat budget')
            checked = await nb.checked_sources()
            if not source_selected(checked, source.name):
                raise EpisodeFactsError('Source selection changed before recheck: '+repr(checked))
            atomic_write(root/'recheck_prompt.txt', question)
            raw = await nb.ask_chat_patient(question, 'FACTS_RECHECK_'+uuid.uuid4().hex, timeout=600)
            atomic_write(root/'recheck_raw.txt', raw)
            card = parse_response(raw, 'reviewed')
            if sha(source.read_bytes()) != identity['source_sha256']:
                raise EpisodeFactsError('Content source changed during extraction')
            prompt = compose(base, card)
            receipt = dict(identity=identity, card=card, prompt_sha256=sha(prompt.encode('utf-8')), completed_at=datetime.now().isoformat(), verification='model_source_recheck', audio_quality_verified=False)
            atomic_write(root/'reviewed.json', dumps(card))
            atomic_write(root/'audio_prompt.txt', prompt)
            atomic_write(receipt_path, json.dumps(receipt, ensure_ascii=False, indent=2))
        except Exception as exc:
            atomic_write(root/'attention.json', json.dumps(dict(error=str(exc), at=datetime.now().isoformat()), ensure_ascii=False))
            raise EpisodeFactsError(f'{name} case preparation failed: {exc}') from exc
        finally:
            if previous:
                await nb.select_sources(previous)
    # Reload, so other episodes and any unrelated edits are retained.
    current = json.loads(prompts_path.read_text(encoding='utf-8'))
    if base_prompt(current[name]) != base:
        raise EpisodeFactsError('Audio base prompt changed while preparing cases')
    if current[name] != prompt:
        current[name] = prompt
        atomic_write(prompts_path, json.dumps(current, ensure_ascii=False, indent=1))
    return receipt


async def prepare_episode_facts(nb, book, ep):
    """Image PDFs use a spoken warning; text sources retain CLI source recheck."""
    sources = [p for p in (book.dir/'sources').glob(f'ep{ep:02d}_content.*')
               if p.suffix in ['.pdf', '.txt']]
    if len(sources) != 1:
        raise EpisodeFactsError('Episode content source missing or ambiguous')
    source = sources[0]
    if source.suffix == '.pdf':
        from .scanpdf import is_text_pdf
        if not is_text_pdf(source):
            return prepare_scan_warning(book, ep, source)
    from .codex_facts import prepare_codex_episode_facts
    return await prepare_codex_episode_facts(book, ep)


def prepare_scan_warning(book, ep, source):
    name = f'EP{ep:02d}'
    path = book.dir/'audio_prompts.json'
    original = json.loads(path.read_text(encoding='utf-8'))
    base = base_prompt(original[name])
    prompt = base+'\n\n'+SCAN_START+'\n'+(
        '本集使用掃描影像來源，未經獨立情節核對。請在開場、正式內容開始前，'
        '由一位主持人完整照唸以下提醒一次，不省略、不改寫、不互相討論這段提醒；'
        '接著自然進入本集內容。這項開場要求優先於其他省略製作流程的要求。\n'
        '「'+SCAN_WARNING+'」\n'
        '仍須忠於原書；辨讀不清的細節不要猜測或補寫。')
    if len(prompt) > 12000:
        raise EpisodeFactsError('Audio prompt exceeds safety limit; no truncation')
    source_hash = sha(source.read_bytes())
    current = json.loads(path.read_text(encoding='utf-8'))
    if base_prompt(current[name]) != base:
        raise EpisodeFactsError('Audio base prompt changed while preparing warning')
    if current[name] != prompt:
        current[name] = prompt
        atomic_write(path, json.dumps(current, ensure_ascii=False, indent=1))
    receipt = dict(version='scan-warning-v1', source=source.name,
                   source_sha256=source_hash, prompt_sha256=sha(prompt.encode('utf-8')),
                   verification='skipped_image_pdf', codex_calls=0,
                   warning_delivery='audio_prompt', warning_text=SCAN_WARNING,
                   audio_quality_verified=False)
    atomic_write(book.dir/'episode_facts'/name/'scan_warning_receipt.json',
                 json.dumps(receipt, ensure_ascii=False, indent=2))
    return receipt
