import sys
import os
import argparse

# Add parent directory to sys.path so 'northlocker' can be imported as a package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from northlocker.ui.app import app_instance
from northlocker.utils.paths import get_vault_path, get_config_path
from northlocker.ui.screens.unlock import build_unlock

def main():
    parser = argparse.ArgumentParser(description="NorthLocker - Terminal Password Manager")
    parser.add_argument("--reset", action="store_true", help="Delete the vault and config to start fresh.")
    args = parser.parse_args()
    
    if args.reset:
        vault_path = get_vault_path()
        config_path = get_config_path()
        
        print("WARNING: This will permanently delete your entire vault and all passwords.")
        confirm = input("Type 'RESET' to confirm: ")
        if confirm == 'RESET':
            if vault_path.exists():
                os.remove(vault_path)
            if config_path.exists():
                os.remove(config_path)
            print("Vault and config deleted. Starting fresh.")
        else:
            print("Reset cancelled.")
            sys.exit(0)
            
    app_instance.set_screen(build_unlock())
    try:
        app_instance.run()
    except Exception as e:
        print(f"Fatal error: {e}")
        
if __name__ == "__main__":
    main()
