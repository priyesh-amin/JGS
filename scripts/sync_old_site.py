import requests
from bs4 import BeautifulSoup
import json
import os
import urllib.parse
from dotenv import load_dotenv

# Set paths based on execution from project root or execution folder
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
data_dir = os.path.join(project_root, 'src', 'data')

def load_fixtures():
    with open(os.path.join(data_dir, 'fixtures.json'), 'r', encoding='utf-8') as f:
        return json.load(f)

def main():
    print("--- Starting Old Site Sync ---")
    load_dotenv(os.path.join(project_root, '.env'))

    username = os.getenv('SCRAPE_USERNAME')
    password = os.getenv('SCRAPE_PASSWORD')
    if not username or not password:
        print("Error: Credentials not found in .env")
        return

    session = requests.Session()

    print("Logging into societygolfing.co.uk...")
    
    # Must GET the login page first to establish cookies (e.g. PHPSESSID)
    session.get('https://societygolfing.co.uk/soclogin.golf')
    
    login_payload = {
        'rformLogin': username,
        'rformPW': password
    }
    
    post_resp = session.post('https://societygolfing.co.uk/checklogin.golf', data=login_payload, allow_redirects=True)
    if post_resp.status_code != 200:
        print("Login failed with status:", post_resp.status_code)
        return

    print("Fetching events page...")
    events_resp = session.get("https://societygolfing.co.uk/events.golf")
    events_soup = BeautifulSoup(events_resp.text, 'html.parser')

    # Find all signed-up list URLs
    list_urls = []
    for a in events_soup.find_all('a', href=True):
        if 'viewsignedup.golf' in a['href'].lower():
            list_urls.append('https://societygolfing.co.uk/' + a['href'])
            
    # De-duplicate URLs
    list_urls = list(set(list_urls))
    print(f"Found {len(list_urls)} event sign-up lists.")

    fixtures = load_fixtures()
    
    # Load existing signups so we only overwrite what we match
    signups_file = os.path.join(data_dir, 'signups.json')
    if os.path.exists(signups_file):
        with open(signups_file, 'r', encoding='utf-8') as f:
            all_signups = json.load(f)
    else:
        all_signups = {f['id']: {'count': 0, 'members': []} for f in fixtures}

    for url in list_urls:
        print(f"\nProcessing {url}...")
        resp = session.get(url)
        soup = BeautifulSoup(resp.text, 'html.parser')
        page_text = soup.get_text()
        
        # Extract the header rows (first 10) to find the event title/date
        header_text = ""
        for i, tr in enumerate(soup.find_all('tr')):
            if i > 15: break
            header_text += tr.get_text() + " "
            
        matched_fixture = None
        for fixture in fixtures:
            date_str = fixture['date'] # "09 May 2026"
            # Try exact match
            if date_str in header_text:
                matched_fixture = fixture
                break
            # Try stripped leading zero "9 May 2026"
            if date_str.startswith('0'):
                if date_str[1:] in header_text:
                    matched_fixture = fixture
                    break
            # Try matching by Event name
            if fixture['event'].lower() in header_text.lower():
                matched_fixture = fixture
                break
            # Try matching by Event name in the URL itself (Event='June Monthly')
            if urllib.parse.unquote(fixture['event']).lower() in urllib.parse.unquote(url).lower():
                matched_fixture = fixture
                break
            # Try matching by Venue Name snippet (just the first word to be safe)
            venue_snippet = fixture['venue'].split(' ')[0].strip().lower()
            if venue_snippet in header_text.lower():
                matched_fixture = fixture
                break
                
        if not matched_fixture:
            print(f"  Warning: Could not match this page to any fixture date.")
            continue
            
        fixture_id = matched_fixture['id']
        print(f"  Matched to fixture: {matched_fixture['event']} ({fixture_id})")
        
        members = []
        parsing_members = False
        
        for tr in soup.find_all('tr'):
            cells = tr.find_all(['td', 'th'])
            texts = [c.text.strip() for c in cells]
            
            if not texts:
                continue
                
            # Detect start of table
            if 'Members Name' in texts and 'Handicap' in texts:
                parsing_members = True
                continue
                
            # Detect end of table
            if parsing_members and ('Back to the Events Page' in texts or 'Members registered as unavailable' in texts):
                parsing_members = False
                break
                
            if parsing_members and len(texts) >= 5:
                name = texts[0]
                if name == '' or name == 'Members Name':
                    continue
                    
                reqs = texts[1]
                email = texts[2]
                hcp_str = texts[3]
                signed_up = texts[4]
                
                try:
                    hcp = float(hcp_str) if hcp_str else ''
                except ValueError:
                    hcp = hcp_str
                
                members.append({
                    'name': name,
                    'requirements': reqs,
                    'email': email,
                    'handicap': hcp,
                    'signedUp': signed_up
                })
                
        # Sort members
        members.sort(key=lambda x: x['name'].lower())
        print(f"  Scraped {len(members)} members.")
        
        all_signups[fixture_id] = {
            'count': len(members),
            'members': members
        }

    # Write back to signups.json
    with open(signups_file, 'w', encoding='utf-8') as f:
        json.dump(all_signups, f, indent=4)
        
    print(f"\n--- Sync Complete. Updated {signups_file} ---")

if __name__ == '__main__':
    main()
