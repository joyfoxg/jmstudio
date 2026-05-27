import subprocess

js_code = """
const raw = 'v = \\\\\\\\frac{V_{\\\\\\\\max}[S]}{K_m\\\\\\\\left(1+\\\\\\\\frac{[I]}{K_i}\\\\\\\\right)+[S]}';
console.log('raw:', raw);

// Using single quotes with four backslashes inside JS: '\\\\'
const clean_sq = raw.replace(/\\\\+/g, '\\\\');
console.log('clean_sq length:', clean_sq.length);
console.log('clean_sq:', clean_sq);
"""

with open('test_js.js', 'w', encoding='utf-8') as f:
    f.write(js_code)

res = subprocess.run(['node', 'test_js.js'], capture_output=True, text=True)
print(res.stdout)
