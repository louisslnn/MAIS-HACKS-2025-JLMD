#!/usr/bin/env python3
"""
Evaluate fine-tuned model performance using Character Error Rate (CER).
"""

import yaml
from pathlib import Path
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from jiwer import cer, wer
import torch

def evaluate_model():
    """Evaluate the fine-tuned model on validation set."""
    script_dir = Path(__file__).parent.parent
    config_file = script_dir / "config.yaml"
    data_dir = script_dir / "data"
    model_dir = script_dir / "models" / "trocr-finetuned"
    
    # Load config
    with open(config_file, 'r') as f:
        config = yaml.safe_load(f)
    
    # Load model and processor
    print("Loading fine-tuned model...")
    if not model_dir.exists():
        print(f"Error: Model not found at {model_dir}")
        print("Please run 03_finetune_trocr.py first to train the model.")
        return
    
    processor = TrOCRProcessor.from_pretrained(model_dir)
    model = VisionEncoderDecoderModel.from_pretrained(model_dir)
    model.eval()
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    
    print(f"Using device: {device}")
    
    # Load validation labels
    val_labels_file = data_dir / "val" / "labels.txt"
    val_images_dir = data_dir / "val" / "images"
    
    labels = []
    with open(val_labels_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '\t' in line:
                img_name, label = line.split('\t', 1)
                labels.append((img_name, label))
    
    print(f"\nEvaluating on {len(labels)} validation samples...\n")
    
    predictions = []
    references = []
    errors = []
    
    with torch.no_grad():
        for i, (img_name, true_label) in enumerate(labels):
            try:
                # Load image
                img_path = val_images_dir / img_name
                image = Image.open(img_path).convert('RGB')
                
                # Process image
                pixel_values = processor(image, return_tensors="pt").pixel_values.to(device)
                
                # Generate prediction
                generated_ids = model.generate(pixel_values)
                generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
                
                predictions.append(generated_text)
                references.append(true_label)
                
                # Calculate error for this sample
                sample_cer = cer(true_label, generated_text)
                if sample_cer > 0:
                    errors.append((img_name, true_label, generated_text, sample_cer))
                
                # Print progress
                if (i + 1) % 10 == 0:
                    print(f"Processed {i + 1}/{len(labels)} samples...")
                
            except Exception as e:
                print(f"Error processing {img_name}: {e}")
                continue
    
    # Calculate overall metrics
    overall_cer = cer(references, predictions)
    overall_wer = wer(references, predictions)
    
    print("\n" + "=" * 60)
    print("EVALUATION RESULTS")
    print("=" * 60)
    print(f"Character Error Rate (CER): {overall_cer:.4f} ({overall_cer * 100:.2f}%)")
    print(f"Word Error Rate (WER): {overall_wer:.4f} ({overall_wer * 100:.2f}%)")
    print(f"Total samples: {len(predictions)}")
    print(f"Samples with errors: {len(errors)}")
    print("=" * 60)
    
    # Show worst errors
    if errors:
        print("\nTop 10 worst predictions:")
        errors.sort(key=lambda x: x[3], reverse=True)
        for img_name, true_label, pred, cer_score in errors[:10]:
            print(f"\nImage: {img_name}")
            print(f"  True:  {true_label}")
            print(f"  Pred:  {pred}")
            print(f"  CER:   {cer_score:.4f}")
    
    # Target CER check
    target_cer = config['evaluation']['target_cer']
    if overall_cer <= target_cer:
        print(f"\n✅ Model meets target CER of {target_cer:.4f} ({target_cer * 100:.2f}%)")
    else:
        print(f"\n⚠️  Model CER ({overall_cer:.4f}) is above target ({target_cer:.4f})")
        print("Consider: training for more epochs, adding more data, or adjusting learning rate")

if __name__ == "__main__":
    evaluate_model()

