#!/bin/bash
# Complete training pipeline script

set -e  # Exit on error

echo "🚀 Starting fine-tuning pipeline..."
echo ""

# Step 1: Collect data
echo "📊 Step 1: Collecting data..."
python scripts/01_collect_data.py
echo ""

# Step 2: Preprocess
echo "🖼️  Step 2: Preprocessing images..."
python scripts/02_preprocess.py
echo ""

# Step 3: Fine-tune
echo "🎓 Step 3: Fine-tuning TrOCR model..."
python scripts/03_finetune_trocr.py
echo ""

# Step 4: Evaluate
echo "📈 Step 4: Evaluating model..."
python scripts/04_evaluate.py
echo ""

echo "✅ Pipeline complete!"
echo "Model saved to: models/trocr-finetuned/"

