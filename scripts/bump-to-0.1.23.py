import os
import json

def update_package_json(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    modified = False
    
    # Update version
    if data.get('version') == '0.1.22':
        data['version'] = '0.1.23'
        modified = True
        
    # Update local dependencies
    for dep_type in ['dependencies', 'devDependencies', 'peerDependencies']:
        if dep_type in data:
            for dep_name in data[dep_type]:
                if dep_name.startswith('@fromcode119/') and data[dep_type][dep_name] == '0.1.22':
                    data[dep_type][dep_name] = '0.1.23'
                    modified = True
                    
    if modified:
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n')
        print(f"Updated {file_path}")

def main():
    base_dir = '.'
    # Update the root package.json if it's there
    root_pkg = os.path.join(base_dir, 'package.json')
    if os.path.exists(root_pkg):
        # Update root version too
        with open(root_pkg, 'r') as f:
            data = json.load(f)
        data['version'] = '0.1.23'
        with open(root_pkg, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n')
        print("Updated root package.json version to 0.1.23")

    packages_dir = os.path.join(base_dir, 'packages')
    for pkg_name in os.listdir(packages_dir):
        pkg_path = os.path.join(packages_dir, pkg_name, 'package.json')
        if os.path.exists(pkg_path):
            update_package_json(pkg_path)

if __name__ == '__main__':
    main()
