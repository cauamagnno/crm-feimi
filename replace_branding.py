import os

replacements = {
    "do Viver de IA": "da Orchestra AI",
    "no Viver de IA": "na Orchestra AI",
    "ao Viver de IA": "à Orchestra AI",
    "Viver de IA": "Orchestra AI",
    "viver-de-ia-nina-webhook": "orchestra-ai-webhook",
    "viver-ia-": "orchestra-ai-",
    "viver-de-ia---saas-platform": "orchestra-ai-crm",
}

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content
        for old, new in replacements.items():
            new_content = new_content.replace(old, new)
            
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
    except Exception as e:
        print(f"Error on {filepath}: {e}")

for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root or '.next' in root:
        continue
    for file in files:
        if file.endswith(('.ts', '.tsx', '.json', '.sql', '.js', '.md')):
            replace_in_file(os.path.join(root, file))
