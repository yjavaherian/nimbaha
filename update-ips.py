import requests
from bs4 import BeautifulSoup
import pandas as pd
import ipaddress
from io import StringIO

base_url = "https://eservices.ito.gov.ir"
page_url = f"{base_url}/Page/IPListSearch"
post_url = f"{base_url}/Page/GetAllIPListSearch"

print("Starting script...")

try:
    with requests.Session() as session:
        # 1. GET page to find the token
        print(f"Fetching token from {page_url}...")
        response_get = session.get(page_url)
        response_get.raise_for_status()
        
        soup = BeautifulSoup(response_get.text, 'html.parser')
        token_input = soup.find('input', {'name': '__RequestVerificationToken'})
        
        if not token_input:
            print("Error: Could not find __RequestVerificationToken")
            exit()
            
        token = token_input['value']

        # 2. POST to get the HTML table data
        form_data = {
            '__RequestVerificationToken': token,
            'ExportExcel': 'true', 
            'WebsiteURL': '',      
            'IPSubnet': ''
        }
        
        print(f"Posting to {post_url} to get IP list...")
        response_post = session.post(post_url, data=form_data)
        response_post.raise_for_status()

    # 3. Read HTML table from in-memory string
    print("Parsing HTML table with pandas...")
    [df] = pd.read_html(StringIO(response_post.text))

    # 4. Extract subnets
    print("Extracting subnets...")
    subnets = [x for x in df['IPNetwork'].to_list() if pd.notna(x)]
    print(f"Found {len(subnets)} subnets.")

    # --- FIX: Separate IPs by version (v4 and v6) ---
    print("Generating and de-duplicating host IPs (v4 and v6)...")
    ipv4_set = set()
    ipv6_set = set()
    invalid_subnets = 0

    for subnet_str in subnets:
        try:
            # Create the network object. strict=False allows
            # host bits (e.g., 192.168.1.1/24)
            net = ipaddress.ip_network(subnet_str, strict=False)
            
            # Add all hosts from this network to the correct set
            if net.version == 4:
                ipv4_set.update(net.hosts())
            elif net.version == 6:
                ipv6_set.update(net.hosts())
                
        except ValueError:
            # Handle cases where the string is not a valid subnet
            invalid_subnets += 1

    if invalid_subnets > 0:
        print(f"Warning: Skipped {invalid_subnets} invalid subnet entries.")
    # --- End of Fix ---

    # 6. Sort each list independently
    print("Sorting unique IPs...")
    sorted_ipv4 = sorted(list(ipv4_set))
    sorted_ipv6 = sorted(list(ipv6_set))

    total_ips = len(sorted_ipv4) + len(sorted_ipv6)
    v4_count = len(sorted_ipv4)
    v6_count = len(sorted_ipv6)
    print(f"Generated {total_ips} total unique IPs ({v4_count} v4, {v6_count} v6).")

    # 7. Write to final file (IPv4 first, then IPv6)
    filename = 'ips.txt'
    print(f"Writing sorted IPs to {filename}...")
    with open(filename, 'w') as f:
        # Write IPv4
        for ip in sorted_ipv4:
            f.write(f"{str(ip)}\n")
            
        # Write IPv6
        for ip in sorted_ipv6:
            f.write(f"{str(ip)}\n")
            
    print(f"Successfully wrote {total_ips} IPs to {filename}.")

except requests.exceptions.RequestException as e:
    print(f"An error occurred: {e}")
except Exception as e:
    print(f"An unexpected error occurred: {e}")