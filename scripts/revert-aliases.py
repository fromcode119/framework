import os
import re

def revert_aliases(package_root):
    # Pattern to find the relative imports we added
    # We want to replace '../../components/...' with '@/components/...'
    # We'll calculate the relative prefix correctly to matches.
    
    for root, dirs, files in os.walk(package_root):
        if 'node_modules' in root or '.next' in root:
            continue
            
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    content = f.read()
                
                # Get the relative path from the current file back to the package root
                rel_to_root = os.path.relpath(package_root, root)
                if rel_to_root == '.':
                    rel_prefix = './'
                else:
                    rel_prefix = rel_to_root + '/'

                # Pattern to find the relative imports we generated
                # matches things like: from '../../components/'
                # We need to escape the dots in the regex.
                escaped_prefix = rel_prefix.replace('.', '\\.')
                pattern = f"(['\"]){escaped_prefix}([^'\"]+)(['\"])"
                
                new_content = re.sub(pattern, f"\\1@/\\2\\3", content)

                if new_content != content:
                    with open(filepath, 'w') as f:
                        f.write(new_content)
                    print(f"Reverted aliases in: {os.path.relpath(filepath, package_root)}")

if __name__ == '__main__':
    admin_root = os.path.abspath('packages/admin')
    print(f"Reverting aliases in {admin_root}...")
    revert_aliases(admin_root)
    
    frontend_root = os.path.abspath('packages/frontend')
    if os.path.exists(frontend_root):
        print(f"Reverting aliases in {frontend_root}...")
        revert_aliases(frontend_root)
