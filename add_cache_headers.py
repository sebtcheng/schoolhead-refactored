import os

def add_no_cache_header(file_path):
    if not os.path.exists(file_path):
        print(f"Not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add Cache-Control: no-store to the progress endpoint response
    old_json = 'res.json({ \n      success: true, \n      progress: { \n        completedUnits,'
    new_json = 'res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");\n    res.json({ \n      success: true, \n      progress: { \n        completedUnits,'

    old_json2 = 'res.json({ success: true, progress: { completedUnits'
    new_json2 = 'res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");\n    res.json({ success: true, progress: { completedUnits'

    # Also handle the unified loop version
    old_json3 = 'res.json({\n      success: true,\n      progress: {\n        completedUnits,'
    new_json3 = 'res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");\n    res.json({\n      success: true,\n      progress: {\n        completedUnits,'

    changed = False
    for old, new in [(old_json, new_json), (old_json2, new_json2), (old_json3, new_json3)]:
        if old in content and new not in content:
            content = content.replace(old, new)
            changed = True
            print(f"✅ Added no-cache header in {file_path}")
            break

    if not changed:
        print(f"⚠️  No match found in {file_path}, may already be patched or pattern differs")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    add_no_cache_header("/var/www/html/InsightEd-Mobile-PWA/insighted-schoolhead/api/index.js")
    add_no_cache_header("/var/www/html/InsightEd-Mobile-PWA/api/index.js")
