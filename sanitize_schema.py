import json

def sanitize_schema(obj):
    if isinstance(obj, dict):
        keys_to_remove = []
        for k, v in obj.items():
            if k in ("exclusiveMinimum", "exclusiveMaximum") and isinstance(v, bool):
                keys_to_remove.append(k)
            else:
                sanitize_schema(v)
        for k in keys_to_remove:
            del obj[k]
    elif isinstance(obj, list):
        for item in obj:
            sanitize_schema(item)

for filename in ["openapi-base.json", "openapi-new.json"]:
    with open(filename, "r") as f:
        data = json.load(f)
    sanitize_schema(data)
    with open(filename, "w") as f:
        json.dump(data, f)
