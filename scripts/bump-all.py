import os
import json

def bump_versions():
    for root, dirs, files in os.walk('packages'):
        # Skip node_modules and .next
        if 'node_modules' in root or '.next' in root:
            continue
            
        if 'package.json' in files:
            pkg_path = os.path.join(root, 'package.json')
            try:
                with open(pkg_path, 'r') as f:
                    data = json.load(f)
                
                if 'version' in data and data.get('name', '').startswith('@fromcode119/'):
                    version_parts = data['version'].split('.')
                    if len(version_parts) == 3:
                        # Increment patch version
                        version_parts[2] = str(int(version_parts[2]) + 1)
                        new_version = '.'.join(version_parts)
                        data['version'] = new_version
                        
                        with open(pkg_path, 'w') as f:
                            json.dump(data, f, indent=2)
                            f.write('\n')
                        print(f"Bumped {data['name']} to {new_version}")
            except Exception as e:
                print(f"Error processing {pkg_path}: {e}")

if __name__ == '__main__':
    bump_versions()
