import os
import urllib.request

dest_dir = os.path.join(os.path.dirname(__file__), "phosphor")
os.makedirs(dest_dir, exist_ok=True)

urls = {
    "style.css": "https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/style.css",
    "Phosphor-Duotone.woff2": "https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/Phosphor-Duotone.woff2",
    "Phosphor-Duotone.woff": "https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/Phosphor-Duotone.woff",
    "Phosphor-Duotone.ttf": "https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/Phosphor-Duotone.ttf",
    "Phosphor-Duotone.svg": "https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/Phosphor-Duotone.svg"
}

for name, url in urls.items():
    dest_path = os.path.join(dest_dir, name)
    print(f"Downloading {url} to {dest_path}...")
    try:
        urllib.request.urlretrieve(url, dest_path)
        print("Success!")
    except Exception as e:
        print(f"Error downloading {name}: {e}")
