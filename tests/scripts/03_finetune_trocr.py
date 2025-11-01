#!/usr/bin/env python3
"""
Fine-tune TrOCR model on handwritten math expressions.
"""

import yaml
from pathlib import Path
from PIL import Image
from transformers import (
    TrOCRProcessor,
    VisionEncoderDecoderModel,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
    default_data_collator
)
from datasets import Dataset
from torch.utils.data import Dataset as TorchDataset
import torch

class HandwritingDataset(TorchDataset):
    """Custom dataset for handwriting images and labels."""
    
    def __init__(self, images_dir, labels_file, processor, max_length=128):
        self.processor = processor
        self.max_length = max_length
        
        # Load labels
        labels = []
        with open(labels_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if '\t' in line:
                    img_name, label = line.split('\t', 1)
                    labels.append((img_name, label))
        
        self.labels = labels
        self.images_dir = Path(images_dir)
    
    def __len__(self):
        return len(self.labels)
    
    def __getitem__(self, idx):
        img_name, text = self.labels[idx]
        
        # Load image
        img_path = self.images_dir / img_name
        image = Image.open(img_path).convert('RGB')
        
        # Process image
        pixel_values = self.processor(image, return_tensors="pt").pixel_values.squeeze()
        
        # Process text
        labels = self.processor.tokenizer(
            text,
            padding="max_length",
            max_length=self.max_length,
            truncation=True,
            return_tensors="pt"
        ).input_ids.squeeze()
        
        # Replace padding token id's of the labels by -100 so it's ignored by the loss
        labels[labels == self.processor.tokenizer.pad_token_id] = -100
        
        return {
            "pixel_values": pixel_values,
            "labels": labels
        }

def load_dataset_from_labels(images_dir, labels_file, processor, max_length=128):
    """Load dataset from images and labels.txt file."""
    return HandwritingDataset(images_dir, labels_file, processor, max_length)

def main():
    """Main training function."""
    script_dir = Path(__file__).parent.parent
    config_file = script_dir / "config.yaml"
    data_dir = script_dir / "data"
    
    # Load config
    with open(config_file, 'r') as f:
        config = yaml.safe_load(f)
    
    print("Loading model and processor...")
    # Load processor and model
    processor = TrOCRProcessor.from_pretrained(config['model']['base_model'])
    model = VisionEncoderDecoderModel.from_pretrained(config['model']['base_model'])
    
    # Enable gradient checkpointing to save memory
    model.config.decoder_start_token_id = processor.tokenizer.cls_token_id
    model.config.pad_token_id = processor.tokenizer.pad_token_id
    model.config.vocab_size = model.config.decoder.vocab_size
    
    # Load datasets
    print("Loading datasets...")
    train_dataset = load_dataset_from_labels(
        data_dir / "train" / "images",
        data_dir / "train" / "labels.txt",
        processor,
        config['data']['max_length']
    )
    
    val_dataset = load_dataset_from_labels(
        data_dir / "val" / "images",
        data_dir / "val" / "labels.txt",
        processor,
        config['data']['max_length']
    )
    
    print(f"Train samples: {len(train_dataset)}")
    print(f"Val samples: {len(val_dataset)}")
    
    # Training arguments
    training_args = Seq2SeqTrainingArguments(
        output_dir=config['model']['output_dir'],
        num_train_epochs=int(config['training']['num_train_epochs']),
        per_device_train_batch_size=int(config['training']['per_device_train_batch_size']),
        per_device_eval_batch_size=int(config['training']['per_device_eval_batch_size']),
        learning_rate=float(config['training']['learning_rate']),  # Ensure float
        warmup_steps=int(config['training']['warmup_steps']),
        weight_decay=float(config['training']['weight_decay']),  # Ensure float
        logging_dir=f"{config['model']['output_dir']}/logs",
        logging_steps=int(config['training']['logging_steps']),
        eval_steps=int(config['training']['eval_steps']),
        save_steps=int(config['training']['save_steps']),
        eval_strategy="steps",  # Changed from evaluation_strategy
        save_strategy="steps",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        push_to_hub=False,
    )
    
    # Create trainer
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=default_data_collator,
        tokenizer=processor.tokenizer,  # Use tokenizer instead of feature_extractor
    )
    
    print("\n🚀 Starting training...")
    print(f"Model will be saved to: {config['model']['output_dir']}")
    
    # Train
    trainer.train()
    
    # Save final model
    trainer.save_model()
    processor.save_pretrained(config['model']['output_dir'])
    
    print(f"\n✅ Training complete! Model saved to {config['model']['output_dir']}")

if __name__ == "__main__":
    main()

