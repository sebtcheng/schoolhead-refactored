import os
import re

root_dir = r"e:\InsightED Official\InsightED-School-Head\src"

for dirpath, dirnames, filenames in os.walk(root_dir):
    for filename in filenames:
        if filename.endswith(('.jsx', '.js', '.ts', '.tsx')):
            filepath = os.path.join(dirpath, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace '/api/ with 'api/ and "/api/ with "api/
            new_content = content.replace("'/api/", "'api/").replace('"/api/', '"api/')
            
            # Also handle backticks: `/api/
            new_content = new_content.replace("`/api/", "`api/")
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated: {filepath}")
