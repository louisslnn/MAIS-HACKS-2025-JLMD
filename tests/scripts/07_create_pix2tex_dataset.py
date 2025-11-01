#!/usr/bin/env python3
"""
Create pix2tex pickle datasets from equations and images.
"""

import sys
from pathlib import Path
from pix2tex.dataset.dataset import Im2LatexDataset

def create_pix2tex_datasets():
    """Create train.pkl and val.pkl for pix2tex."""
    script_dir = Path(__file__).parent.parent
    pix2tex_dir = script_dir / "dataset"
    
    # Generate or use tokenizer
    tokenizer_path = str(pix2tex_dir / "tokenizer.json")
    
    if not Path(tokenizer_path).exists():
        # Generate tokenizer from our equations
        print("Generating tokenizer from equations...")
        from tokenizers import Tokenizer, pre_tokenizers
        from tokenizers.models import BPE
        from tokenizers.trainers import BpeTrainer
        
        # Read all equations
        train_eq_file = pix2tex_dir / "data" / "train_equations.txt"
        val_eq_file = pix2tex_dir / "data" / "val_equations.txt"
        
        equations = []
        if train_eq_file.exists():
            with open(train_eq_file, 'r', encoding='utf-8') as f:
                equations.extend([line.strip() for line in f if line.strip()])
        if val_eq_file.exists():
            with open(val_eq_file, 'r', encoding='utf-8') as f:
                equations.extend([line.strip() for line in f if line.strip()])
        
        if not equations:
            print("Error: No equations found. Cannot generate tokenizer.")
            return None, None
        
        # Create tokenizer
        tokenizer = Tokenizer(BPE(unk_token="[UNK]"))
        tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
        trainer = BpeTrainer(
            special_tokens=["[PAD]", "[BOS]", "[EOS]"], 
            vocab_size=8000, 
            show_progress=True
        )
        
        # Train tokenizer
        tokenizer.train_from_iterator(equations, trainer)
        tokenizer.save(tokenizer_path)
        print(f"✅ Generated tokenizer: {tokenizer_path}")
    else:
        print(f"Using existing tokenizer: {tokenizer_path}")
    
    # Create datasets
    def create_dataset(split_name):
        """Create pickle dataset for train or val."""
        eq_file = pix2tex_dir / "data" / f"{split_name}_equations.txt"
        images_dir = pix2tex_dir / "images" / split_name
        output_pkl = pix2tex_dir / "data" / f"{split_name}.pkl"
        
        if not eq_file.exists() or not images_dir.exists():
            print(f"Warning: Missing files for {split_name}")
            return None
        
        print(f"\nCreating {split_name} dataset...")
        
        try:
            # Create dataset with tokenizer
            dataset = Im2LatexDataset(
                equations=str(eq_file),
                images=str(images_dir),
                tokenizer=tokenizer_path if Path(tokenizer_path).exists() else None
            )
            
            # Update batch size
            dataset.update(batchsize=1, keep_smaller_batches=True)
            
            # Save as pickle
            output_pkl.parent.mkdir(parents=True, exist_ok=True)
            dataset.save(str(output_pkl))
            
            print(f"✅ Created {output_pkl}")
            return output_pkl
        
        except Exception as e:
            print(f"Error creating {split_name} dataset: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    train_pkl = create_dataset("train")
    val_pkl = create_dataset("val")
    
    if train_pkl and val_pkl:
        print("\n✅ Datasets created successfully!")
        print(f"Train: {train_pkl}")
        print(f"Val: {val_pkl}")
        return train_pkl, val_pkl
    else:
        print("\n❌ Failed to create datasets")
        return None, None

if __name__ == "__main__":
    create_pix2tex_datasets()

