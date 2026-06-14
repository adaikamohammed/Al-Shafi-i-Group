import json

log_path = r"C:\Users\زكريا\.gemini\antigravity\brain\0b33d6f4-ada5-4b7b-9408-ff743317e8e0\.system_generated\logs\transcript.jsonl"
out_path = r"g:\Al-Shafi-i-Group-main\Al-Shafi-i-Group-main\scratch\user_requests.txt"

with open(log_path, 'r', encoding='utf-8') as f, open(out_path, 'w', encoding='utf-8') as out:
    out.write("Searching for messages containing grading and behavior terms...\n\n")
    for line in f:
        try:
            data = json.loads(line)
            if data.get("type") == "USER_INPUT":
                content = data.get("content", "")
                if any(k in content for k in ["سلوك", "نقاط", "ممتاز", "مقبول", "ضعيف", "متوسط", "غير منضبط"]):
                    out.write(f"Step {data.get('step_index')}:\n")
                    out.write(content)
                    out.write("\n" + "-" * 40 + "\n")
        except Exception as e:
            pass
print("Done writing to scratch/user_requests.txt")
