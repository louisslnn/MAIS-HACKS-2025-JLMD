#!/usr/bin/env python3
"""
Prepare data for pix2tex training format.
Converts labels.txt format to pix2tex format (equations file + images).
"""

import os
from pathlib import Path

def prepare_pix2tex_data():
    """Convert labels.txt format to pix2tex equations format."""
    script_dir = Path(__file__).parent.parent
    data_dir = script_dir / "data"
    pix2tex_dir = script_dir / "dataset"
    
    # Create pix2tex dataset structure
    (pix2tex_dir / "data").mkdir(parents=True, exist_ok=True)
    (pix2tex_dir / "images").mkdir(parents=True, exist_ok=True)
    
    def convert_split(split_name):
        """Convert train or val split."""
        labels_file = data_dir / split_name / "labels.txt"
        images_dir = data_dir / split_name / "images"
        pix2tex_images_dir = pix2tex_dir / "images" / split_name
        
        pix2tex_images_dir.mkdir(parents=True, exist_ok=True)
        
        # Read labels and copy images with proper numbering
        equations = []
        image_pairs = []
        
        if not labels_file.exists():
            print(f"Warning: {labels_file} not found")
            return []
        
        with open(labels_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if '\t' in line:
                    img_name, label = line.split('\t', 1)
                    
                    src_img = images_dir / img_name
                    if src_img.exists():
                        # Clean label: remove double braces for pix2tex
                        clean_label = label.strip('{}')
                        image_pairs.append((src_img, clean_label))
        
        # Sort to ensure consistent ordering
        image_pairs.sort(key=lambda x: x[0].name)
        
        # Copy images with numbered names and collect equations
        import shutil
        for idx, (src_img, label) in enumerate(image_pairs):
            # pix2tex expects numbered images: 0.png, 1.png, etc.
            ext = src_img.suffix.lower()
            if ext not in ['.png', '.jpg', '.jpeg']:
                ext = '.png'
            dst_img = pix2tex_images_dir / f"{idx}{ext}"
            shutil.copy2(src_img, dst_img)
            equations.append(label)
        
        return equations
    
    # Convert train and val
    print("Preparing pix2tex data format...")
    train_equations = convert_split("train")
    val_equations = convert_split("val")
    
    # Write equations files
    train_eq_file = pix2tex_dir / "data" / "train_equations.txt"
    val_eq_file = pix2tex_dir / "data" / "val_equations.txt"
    
    with open(train_eq_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(train_equations))
    
    with open(val_eq_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(val_equations))
    
    print(f"✅ Created {train_eq_file} with {len(train_equations)} equations")
    print(f"✅ Created {val_eq_file} with {len(val_equations)} equations")
    
    return train_eq_file, val_eq_file, pix2tex_dir

if __name__ == "__main__":
    prepare_pix2tex_data()

