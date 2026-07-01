import re

def clean_file_mystats(file_path):
    print(f"Cleaning {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove from DEFAULT_WEIGHTS
    content = re.sub(r',\s*punctualityBonus:\s*5', '', content)
    content = re.sub(r'punctualityBonus:\s*5,?\s*', '', content)
    content = re.sub(r'\s*punctualityBonus:\s*number;[^\n]*\n', '\n', content)

    # 2. Remove isSessionPunctual function definition
    content = re.sub(r'const\s+isSessionPunctual\s*=\s*\(session:\s*any\):\s*boolean\s*=>\s*\{.*?\}\s*;?\n', '', content, flags=re.DOTALL)

    # 3. Remove punctualityBonus restoration from Firebase
    content = re.sub(r'\s*punctualityBonus:\s*typeof\s*val\.punctualityBonus\s*===.*?\n', '\n', content)

    # 4. Remove punctualSessions parameter and calculation in calculatePoints
    content = re.sub(r'\s*punctualSessions:\s*number;?\n', '', content)
    content = re.sub(r'\s*const\s+punctualityBonus\s*=\s*.*?;', '', content)
    content = re.sub(r'\s*\+\s*punctualityBonus', '', content)
    content = re.sub(r'\s*punctualityBonus,?\n', '\n', content)

    # 5. Remove loop variable let punctualSessions = 0;
    content = re.sub(r'\s*let\s+punctualSessions\s*=\s*0;?\n', '', content)
    content = re.sub(r'\s*if\s*\(\s*isSessionPunctual\(stats\.session\)\s*\)\s*\{\s*punctualSessions\+\+;?\s*\}', '', content)

    # 6. Remove punctualSessions parameter from calculatePoints call
    content = re.sub(r'\s*punctualSessions,?\n', '', content)

    # 7. Remove punctualSessionsCount and punctualityBonus from scores mapping
    content = re.sub(r'\s*punctualSessionsCount:\s*punctualSessions,?\n', '', content)
    content = re.sub(r'\s*punctualityBonus:\s*pts\.punctualityBonus,?\n', '', content)
    content = re.sub(r'\s*punctualSessionsCount:\s*s\.punctualSessionsCount,?\n', '', content)
    content = re.sub(r'\s*punctualityBonus:\s*s\.punctualityBonus,?\n', '', content)

    # 8. Remove the card UI for "بونص التوثيق السريع"
    content = re.sub(r'\s*{\s*label:\s*\'بونص التوثيق السريع\'.*?},\s*\n', '', content)

    # 9. Remove recommendation about speed of registering sessions
    content = re.sub(r'\s*\{\s*bestMonthOverall\.totalPoints.*?weights\.punctualityBonus.*?\}\s*\n', '', content, flags=re.DOTALL)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done cleaning my-stats file")

clean_file_mystats(r"G:\Al-Shafi-i-Group-main\Al-Shafi-i-Group-main\src\app\management\my-stats\page.tsx")
