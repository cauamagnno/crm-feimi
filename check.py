import urllib.request, json
url = "FALLBACK"
key = "FALLBACK"
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('VITE_SUPABASE_URL='):
            url = line.strip().split('=', 1)[1].strip('"\'')
        elif line.startswith('VITE_SUPABASE_ANON_KEY='):
            key = line.strip().split('=', 1)[1].strip('"\'')

req = urllib.request.Request(f"{url}/rest/v1/team_members?email=eq.dudasodre@hiveme.com.br")
req.add_header('apikey', key)
req.add_header('Authorization', f'Bearer {key}')

try:
    with urllib.request.urlopen(req) as response:
        print("DB Response:", response.read().decode('utf-8'))
except Exception as e:
    print(e)
