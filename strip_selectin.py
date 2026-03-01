import os
import glob

models_dir = r"c:\Users\19803\Projects\FactoryExcelManager\backend\app\models"

def remove_selectin(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We are replacing `, lazy="selectin"` and `lazy="selectin",`
    if 'lazy="selectin"' in content:
        content = content.replace(', lazy="selectin"', '')
        content = content.replace('lazy="selectin",\n', '')
        content = content.replace('lazy="selectin",', '')
        content = content.replace(' lazy="selectin"', '')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(models_dir):
    for file in files:
        if file.endswith('.py'):
            remove_selectin(os.path.join(root, file))
