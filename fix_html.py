
import os

file_path = r'c:\Users\ADMIN\.gemini\antigravity\scratch\school_attendance\نظام_مع_google_sheets.html'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep lines 1-391 (indices 0-390)
part1 = lines[:391]

# Keep lines 587-End (indices 586-End)
# Note: Line 587 in 1-based is index 586 in 0-based.
part2 = lines[586:]

# Optional: Fix indentation for part2
# The first line of part2 is '<div id="teacherPage" class="page">' which has 32 spaces.
# We want it to have 8 spaces (to match part1's indentation level).
# So we need to remove 24 spaces from the start of each line in part2, if possible.
# But we should be careful only to remove common leading whitespace.

# Let's just write it as is first to ensure correctness of content.
new_content = part1 + part2

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print(f"Fixed file. Total lines: {len(new_content)}")
