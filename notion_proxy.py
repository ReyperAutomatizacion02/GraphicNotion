from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

NOTION_API_URL = "https://api.notion.com/v1/search"
NOTION_VERSION = "2022-06-28"

@app.route('/notion/databases', methods=['POST'])
def notion_databases():
    data = request.get_json()
    token = data.get('token')
    if not token:
        return jsonify({'error': 'No Notion token provided'}), 400

    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
    }
    body = {
        "filter": { "property": "object", "value": "database" }
    }
    try:
        resp = requests.post(NOTION_API_URL, headers=headers, json=body)
        return (resp.text, resp.status_code, {'Content-Type': 'application/json'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/notion/database_properties', methods=['POST'])
def notion_database_properties():
    data = request.get_json()
    token = data.get('token')
    database_id = data.get('database_id')
    if not token or not database_id:
        return jsonify({'error': 'No Notion token or database_id provided'}), 400

    url = f"https://api.notion.com/v1/databases/{database_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
    }
    try:
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            return (resp.text, resp.status_code, {'Content-Type': 'application/json'})
        db = resp.json()
        properties = db.get('properties', {})
        grouped = {}
        for prop_name, prop_info in properties.items():
            prop_type = str(prop_info.get('type', 'unknown')).strip().lower()
            grouped.setdefault(prop_type, []).append({
                'name': prop_name,
                'info': prop_info
            })
        # Ordenar tipos y nombres de propiedades
        sorted_grouped = {}
        for k in sorted(grouped.keys()):
            sorted_grouped[k] = sorted(grouped[k], key=lambda x: x['name'].lower())
        return jsonify(sorted_grouped)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Permitir CORS para desarrollo local
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    return response

if __name__ == '__main__':
    app.run(port=5001, debug=True)