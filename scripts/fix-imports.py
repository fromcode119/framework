import os
import re

def update_file(filepath):
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        dir_path = os.path.dirname(filepath)

        def replacer(match):
            prefix = match.group(1)
            original_path = match.group(2)
            suffix = match.group(3)
            
            # Skip non-relative or already extensioned imports
            if not original_path.startswith('.') or re.search(r'\.\w+$', original_path):
                return match.group(0)
            
            # Resolve absolute path of the target in dist/
            target_full_path = os.path.abspath(os.path.join(dir_path, original_path))
            
            # If it's a directory, point to index.js
            if os.path.isdir(target_full_path):
                new_path = f"{original_path.rstrip('/')}/index.js"
            else:
                # If it's a file, add .js
                new_path = f"{original_path}.js"
            
            return f'{prefix}{new_path}{suffix}'

        new_content = re.sub(r"(from\s+['\"])([^'\"]+)(['\"])", replacer, content)
        new_content = re.sub(r"(export\s+\*\s+from\s+['\"])([^'\"]+)(['\"])", replacer, new_content)

        if new_content != content:
            with open(filepath, 'w') as f:
                f.write(new_content)
    except Exception as e:
        print(f'Error processing {filepath}: {e}')

# Call from framework/Source root
targets = [
    'packages/sdk/dist',
    'packages/core/dist',
    'packages/auth/dist',
    'packages/database/dist',
    'packages/media/dist',
    'packages/react/dist',
    'packages/api/dist'
]

for base in targets:
    if not os.path.exists(base): continue
    print(f'Processing built artifacts in {base}...')
    for root, dirs, files in os.walk(base):
        for f in files:
            if f.endswith(('.js', '.d.ts', '.mjs')):
                update_file(os.path.join(root, f))
