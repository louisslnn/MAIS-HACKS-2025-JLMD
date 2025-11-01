#!/usr/bin/env python3
"""
Preprocess images for training: resize, normalize, convert to RGB.
"""

from pathlib import Path
from PIL import Image
import yaml

def preprocess_images():
    """Preprocess all images in data/train and data/val."""
    script_dir = Path(__file__).parent.parent
    data_dir = script_dir / "data"
    config_file = script_dir / "config.yaml"
    
    # Load config
    with open(config_file, 'r') as f:
        config = yaml.safe_load(f)
    
    image_size = config['data']['image_size']
    
    for split in ['train', 'val']:
        images_dir = data_dir / split / "images"
        
        if not images_dir.exists():
            print(f"Warning: {images_dir} does not exist")
            continue
        
        print(f"Preprocessing {split} images...")
        
        image_files = list(images_dir.glob("*.png")) + list(images_dir.glob("*.jpg"))
        
        for img_path in image_files:
            try:
                # Load and preprocess
                img = Image.open(img_path).convert('RGB')
                
                # Resize maintaining aspect ratio
                img.thumbnail((image_size, image_size), Image.Resampling.LANCZOS)
                
                # Create new image with target size (pad if needed)
                new_img = Image.new('RGB', (image_size, image_size), (255, 255, 255))
                
                # Calculate position to center
                x = (image_size - img.width) // 2
                y = (image_size - img.height) // 2
                new_img.paste(img, (x, y))
                
                # Save
                new_img.save(img_path)
                
            except Exception as e:
                print(f"Error processing {img_path}: {e}")
        
        print(f"✅ Preprocessed {len(image_files)} {split} images")

if __name__ == "__main__":
    preprocess_images()

