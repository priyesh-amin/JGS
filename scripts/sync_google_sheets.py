
import requests
import pandas as pd
import json
import io
import io
import os
from datetime import datetime
import pytz # Need to make sure pytz is available or use standard timezone

# --- Configuration ---
SPREADSHEET_ID = '1CT8BuIQOhymev6m7JTOcSfOGFJbSi_UjdNCH4Jkqbh0'
GIDS = {
    'DB_Fixtures': '1747129771',
    'DB_Leaderboards': '253779450'
}

OUTPUT_DIR = r'g:\My Drive\0 DOE Jaguar Golf Society\jaguar-golf-society\src\data'

# --- Functions ---

def fetch_csv(gid):
    """Fetches CSV data from a Google Sheet tab."""
    url = f'https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv&gid={gid}'
    print(f"Fetching GID {gid}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
        return pd.read_csv(io.StringIO(response.text))
    except Exception as e:
        print(f"Error fetching GID {gid}: {e}")
        import sys
        sys.exit(1)

def process_fixtures(df):
    """Transforms Fixtures CSV DataFrame to JSON structure."""
    if df is None: return []
    
    fixtures = []
    for _, row in df.iterrows():
        # Handle boolean fields
        is_charity = str(row.get('IsCharityDay', 'FALSE')).upper() == 'TRUE'
        
        item = {
            "id": str(row['ID']),
            "date": str(row['Date']),
            "event": str(row['Event']),
            "venue": str(row['Venue']),
            "cost": str(row['Cost']),
            "status": str(row['Status']),
            "isCharityDay": is_charity
        }

        # Optional fields - only add if not empty (NaN)
        if pd.notna(row.get('MeetTime')): item['meetTime'] = str(row['MeetTime'])
        if pd.notna(row.get('TeeTime')): item['teeTime'] = str(row['TeeTime'])
        if pd.notna(row.get('Deadline')): item['deadline'] = str(row['Deadline'])
        if pd.notna(row.get('Details')): item['details'] = str(row['Details'])
        if pd.notna(row.get('Capacity')): item['capacity'] = int(row['Capacity']) if pd.notna(row['Capacity']) and str(row['Capacity']).isdigit() else str(row['Capacity'])
        if pd.notna(row.get('Package')): item['package'] = str(row['Package'])
        if pd.notna(row.get('Schedule')): item['schedule'] = str(row['Schedule'])
        
        fixtures.append(item)
    return fixtures

def process_leaderboards(df):
    """Transforms Leaderboards CSV DataFrame to JSON structure."""
    if df is None: return {}

    leaderboards = {
        "poy": [],
        "singles": [],
        "radha": [],
        "doubles": []
    }

    for _, row in df.iterrows():
        category = str(row['Category']).lower().strip()
        
        if category not in leaderboards:
            continue

        item = {
            "year": str(row['Year']),
            "winner": str(row['Winner'])
        }

        # Add Score only for Radha (or if present)
        if pd.notna(row.get('Score')) and str(row['Score']).strip() != '':
             item['score'] = str(row['Score'])

        leaderboards[category].append(item)
    
    return leaderboards

def main():
    print("--- Starting Google Sheet Sync ---")
    
    # 1. Fixtures
    df_fixtures = fetch_csv(GIDS['DB_Fixtures'])
    if df_fixtures is not None:
        fixtures_json = process_fixtures(df_fixtures)
        out_path = os.path.join(OUTPUT_DIR, 'fixtures.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(fixtures_json, f, indent=4)
        print(f"Updated: {out_path}")

    # 2. Leaderboards
    df_lb = fetch_csv(GIDS['DB_Leaderboards'])
    if df_lb is not None:
        lb_json = process_leaderboards(df_lb)
        out_path = os.path.join(OUTPUT_DIR, 'leaderboards.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(lb_json, f, indent=4)
        print(f"Updated: {out_path}")

        print(f"Updated: {out_path}")

    # 3. Metadata (Timestamp)
    metadata = {
        "lastUpdated": datetime.now().isoformat(),
        "syncStatus": "Success"
    }
    meta_path = os.path.join(OUTPUT_DIR, 'metadata.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=4)
    print(f"Updated: {meta_path}")

    print("--- Sync Complete ---")

if __name__ == "__main__":
    main()
