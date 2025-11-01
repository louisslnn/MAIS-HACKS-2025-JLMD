#!/usr/bin/env python3
"""
Run inference on a single image using the fine-tuned model.
"""

import sys
from pathlib import Path
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
import torch

def run_inference(image_path, model_dir=None):
    """Run inference on a single image."""
    if model_dir is None:
        script_dir = Path(__file__).parent.parent
        model_dir = script_dir / "models" / "trocr-finetuned"
    
    if not Path(model_dir).exists():
        print(f"Error: Model not found at {model_dir}")
        print("Please run 03_finetune_trocr.py first to train the model.")
        return None
    
    # Load model and processor
    print("Loading fine-tuned model...")
    processor = TrOCRProcessor.from_pretrained(model_dir)
    model = VisionEncoderDecoderModel.from_pretrained(model_dir)
    model.eval()
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    
    # Load image
    image = Image.open(image_path).convert('RGB')
    
    # Process
    pixel_values = processor(image, return_tensors="pt").pixel_values.to(device)
    
    # Generate
    with torch.no_grad():
        generated_ids = model.generate(pixel_values)
        generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    
    return generated_text

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python 05_inference.py <image_path> [model_dir]")
        print("\nExample:")
        print("  python 05_inference.py ../written_answers/IMG_0010.png")
        sys.exit(1)
    
    image_path = sys.argv[1]
    model_dir = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not Path(image_path).exists():
        print(f"Error: Image not found at {image_path}")
        sys.exit(1)
    
    print(f"Processing image: {image_path}")
    result = run_inference(image_path, model_dir)
    
    if result:
        print(f"\nRecognized text: {result}")
    else:
        sys.exit(1)

