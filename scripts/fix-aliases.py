import os
import re

def fix_aliases(package_root):
    # Mapping of common root-level directories in the package
    # In admin, these are app, components, lib, etc.
    # We want to replace '@/components/...' with the relative path to 'components/...' from the current file.
    
    for root, dirs, files in os.walk(package_root):
        # Skip node_modules and .next
        if 'node_modules' in root or '.next' in root:
            continue
            
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    content = f.read()
                
                # Get the relative path from the current file to the package root
                rel_to_root = os.path.relpath(package_root, root)
                if rel_to_root == '.':
                    rel_prefix = './'
                else:
                    # os.path.relpath('a', 'a/b/c') -> '../..'
                    rel_prefix = rel_to_root + '/'

                # Pattern to find @/ imports
                # matches: from '@/components/...' or import '@/components/...'
                # Also handles vi.mock('@/...') and vi.importActual('@/...')
                pattern = r"(['\"])@/([^'\"]+)(['\"])"
                
                new_content = re.sub(pattern, lambda m: f"{m.group(1)}{rel_prefix}{m.group(2)}{m.group(3)}", content)
                
                if new_content != content:
                    with open(filepath, 'w') as f:
                        f.write(new_content)
                    print(f"Fixed aliases in: {os.path.relpath(filepath, package_root)}")

if __name__ == '__main__':
    admin_root = os.path.abspath('packages/admin')
    print(f"Fixing @/ aliases in {admin_root}...")
    fix_aliases(admin_root)
    
    frontend_root = os.path.abspath('packages/frontend')
    if os.path.exists(frontend_root):
        print(f"Fixing @/ aliases in {frontend_root}...")
        fix_aliases(frontend_root)
