#!/usr/bin/env python3
"""
Collect and organize handwritten images from written_answers folder.
Creates train/val split and generates labels.txt files.
"""

import os
import json
import random
import shutil
from pathlib import Path
from collections import defaultdict

def load_questions():
    """Load questions.json to get correct answers."""
    script_dir = Path(__file__).parent.parent.parent
    questions_file = script_dir / "questions.json"
    
    with open(questions_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def collect_data_from_written_answers():
    """Collect images and their labels from written_answers folder."""
    script_dir = Path(__file__).parent.parent.parent
    written_answers_dir = script_dir / "written_answers"
    data_dir = Path(__file__).parent.parent / "data"
    
    # Get all PNG images
    images = list(written_answers_dir.glob("*.png")) + list(written_answers_dir.glob("*.jpg"))
    
    if not images:
        print(f"No images found in {written_answers_dir}")
        print("Please add some handwritten answer images first.")
        return
    
    print(f"Found {len(images)} images")
    
    # Load questions for labels
    questions_data = load_questions()
    
    # Group images by category and question_id
    image_labels = []
    
    for img_path in images:
        filename = img_path.stem  # e.g., "addition_1_20241101_120000"
        parts = filename.split('_')
        
        if len(parts) >= 2:
            category = parts[0]  # addition or integrals
            try:
                question_id = int(parts[1])
                
                # Find the correct answer
                if category in questions_data:
                    for q in questions_data[category]:
                        if q['id'] == question_id:
                            label = str(q['answer'])
                            image_labels.append((img_path, label, category))
                            break
            except ValueError:
                print(f"Warning: Could not parse question_id from {filename}")
                continue
    
    if not image_labels:
        print("No valid image-label pairs found.")
        print("Images should be named: {category}_{question_id}_{timestamp}.png")
        return
    
    # Create train/val split (80/20)
    random.seed(42)
    random.shuffle(image_labels)
    split_idx = int(len(image_labels) * 0.8)
    train_data = image_labels[:split_idx]
    val_data = image_labels[split_idx:]
    
    print(f"Train: {len(train_data)} images, Val: {len(val_data)} images")
    
    # Create directories
    train_images_dir = data_dir / "train" / "images"
    val_images_dir = data_dir / "val" / "images"
    train_images_dir.mkdir(parents=True, exist_ok=True)
    val_images_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy images and create labels.txt
    def process_split(data, images_dir, labels_file):
        labels = []
        for img_path, label, category in data:
            # Copy image
            new_img_path = images_dir / img_path.name
            shutil.copy2(img_path, new_img_path)
            
            # Add to labels
            labels.append(f"{img_path.name}\t{label}")
        
        # Write labels.txt
        with open(labels_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(labels))
        
        print(f"Created {labels_file} with {len(labels)} entries")
    
    train_labels_file = data_dir / "train" / "labels.txt"
    val_labels_file = data_dir / "val" / "labels.txt"
    
    process_split(train_data, train_images_dir, train_labels_file)
    process_split(val_data, val_images_dir, val_labels_file)
    
    print("\n✅ Data collection complete!")
    print(f"Training data: {train_labels_file}")
    print(f"Validation data: {val_labels_file}")

if __name__ == "__main__":
    collect_data_from_written_answers()

