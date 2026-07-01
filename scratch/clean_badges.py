import re

def clean_file_badges(file_path):
    print(f"Cleaning {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove punctualityBonus: number;
    content = re.sub(r'\s*punctualityBonus:\s*number;[^\n]*\n', '\n', content)
    
    # 2. Remove punctualityBonus: 5
    content = re.sub(r',\s*punctualityBonus:\s*5', '', content)
    content = re.sub(r'punctualityBonus:\s*5,?\s*', '', content)

    # 3. Remove punctualSessionsCount: number;
    content = re.sub(r'\s*punctualSessionsCount:\s*number;[^\n]*\n', '\n', content)

    # 4. Remove punctualityBonus restoration from Firebase
    content = re.sub(r'\s*punctualityBonus:\s*typeof\s*val\.punctualityBonus\s*===.*?\n', '\n', content)

    # 5. Remove punctualSessionsCount serialization
    content = re.sub(r'\s*punctualSessionsCount:\s*s\.punctualSessionsCount,?\n', '', content)

    # 6. Remove punctualityBonus serialization
    content = re.sub(r'\s*punctualityBonus:\s*s\.punctualityBonus,?\n', '', content)
    content = re.sub(r'\s*punctualityBonus:\s*pts\.punctualityBonus,?\n', '', content)

    # 7. Remove punctualSessions input in settings drawer/list
    content = re.sub(r'\s*{\s*key:\s*\'punctualityBonus\'.*?},\s*\n', '', content)

    # 8. Remove sheikh.punctualityBonus > 0 display block
    content = re.sub(r'\s*{\s*sheikh\.punctualityBonus\s*>\s*0.*?}\s*', '', content)

    # 9. Remove intizam card from list
    content = re.sub(r'\s*{\s*label:\s*\'انتظام توقيت تسجيل الحصص\'.*?},\s*\n', '', content)

    # 10. Remove from calculatePoints parameters
    content = re.sub(r'\s*punctualSessions:\s*number;?\n', '', content)

    # 11. Remove punctualityBonus calculation in calculatePoints
    # Look for: const punctualityBonus = ...;
    content = re.sub(r'\s*const\s+punctualityBonus\s*=\s*.*?;', '', content)
    
    # Remove punctualityBonus from totalPoints sum: + punctualityBonus
    content = re.sub(r'\s*\+\s*punctualityBonus', '', content)
    
    # Remove punctualityBonus from calculatePoints return
    content = re.sub(r'\s*punctualityBonus,?\n', '\n', content)

    # 12. Remove punctualSessions count loop variables and incrementation
    content = re.sub(r'\s*let\s+punctualSessions\s*=\s*0;?\n', '', content)
    content = re.sub(r'\s*if\s*\(\s*isSessionPunctual\(stats\.session\)\s*\)\s*punctualSessions\+\+;?\n', '', content)
    content = re.sub(r'\s*if\s*\(\s*isSessionPunctual\(stats\.session\)\s*\)\s*\{\s*punctualSessions\+\+;?\s*\}', '', content)
    content = re.sub(r'\s*if\s*\(\s*isSessionPunctual\(stats\.session\)\s*\)\s*\{\s*dayPts\s*\+=\s*weights\.punctualityBonus;?\s*\}', '', content)

    # 13. Remove punctualSessions from params call in calculatePoints
    content = re.sub(r'\s*punctualSessions,?\n', '', content)

    # 14. Clean any double commas or empty lines
    content = re.sub(r',\s*,', ',', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done cleaning badges file")

clean_file_badges(r"G:\Al-Shafi-i-Group-main\Al-Shafi-i-Group-main\src\components\management\SheikhBadges.tsx")
