import json, os, threading

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
_locks = {}
DEFAULT_LLM_MODEL = "qwen3.6-flash"
DEFAULT_TTS_SPEED_PROFILE = "standard"


def _normalize_settings(settings):
    data = dict(settings or {})
    model = data.get("llm_model")
    if model == "qwen3.5-flash" or not model:
        data["llm_model"] = DEFAULT_LLM_MODEL
    if data.get("tts_speed_profile") not in {"slow", "standard", "fast"}:
        data["tts_speed_profile"] = DEFAULT_TTS_SPEED_PROFILE
    return data

def _get_lock(name):
    if name not in _locks:
        _locks[name] = threading.Lock()
    return _locks[name]

def read_json(filename):
    path = os.path.join(DATA_DIR, filename)
    with _get_lock(filename):
        if not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []

def write_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with _get_lock(filename):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

def append_json(filename, item):
    data = read_json(filename)
    data.append(item)
    write_json(filename, data)
    return data

def update_json(filename, key, value, updates):
    data = read_json(filename)
    for item in data:
        if item.get(key) == value:
            item.update(updates)
    write_json(filename, data)
    return data

def find_one(filename, key, value):
    data = read_json(filename)
    for item in data:
        if item.get(key) == value:
            return item
    return None

def find_many(filename, key, value):
    data = read_json(filename)
    return [item for item in data if item.get(key) == value]

def read_settings():
    path = os.path.join(DATA_DIR, "settings.json")
    with _get_lock("settings.json"):
        if not os.path.exists(path):
            return _normalize_settings({})
        with open(path, "r", encoding="utf-8") as f:
            try:
                return _normalize_settings(json.load(f))
            except json.JSONDecodeError:
                return _normalize_settings({})

def write_settings(data):
    path = os.path.join(DATA_DIR, "settings.json")
    with _get_lock("settings.json"):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(_normalize_settings(data), f, ensure_ascii=False, indent=2)

def update_settings(updates):
    settings = read_settings()
    settings.update(updates)
    write_settings(settings)
    return settings
