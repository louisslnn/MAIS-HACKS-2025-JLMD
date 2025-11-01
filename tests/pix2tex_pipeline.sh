#!/bin/bash
# Complete pix2tex fine-tuning pipeline

set -e  # Exit on error

echo "🚀 Starting pix2tex fine-tuning pipeline..."
echo ""

# Step 1: Collect data from written_answers
echo "📊 Step 1: Collecting data..."
python3 scripts/01_collect_data.py
echo ""

# Step 2: Preprocess images
echo "🖼️  Step 2: Preprocessing images..."
python3 scripts/02_preprocess.py
echo ""

# Step 3: Prepare pix2tex format
echo "🔄 Step 3: Converting to pix2tex format..."
python3 scripts/06_prepare_pix2tex_data.py
echo ""

# Step 4: Create pix2tex datasets (pickle files)
echo "📦 Step 4: Creating pix2tex pickle datasets..."
python3 scripts/07_create_pix2tex_dataset.py
echo ""

# Step 5: Update config paths (already set, just verify)
echo "⚙️  Step 5: Verifying config..."
python3 -c "
import yaml
from pathlib import Path

config_file = Path('configs/train.yaml')
with open(config_file, 'r') as f:
    config = yaml.safe_load(f)

config['data'] = 'dataset/data/train.pkl'
config['valdata'] = 'dataset/data/val.pkl'
config['tokenizer'] = 'dataset/tokenizer.json'
config['wandb'] = False
config['batchsize'] = 4  # Smaller batch for small dataset
config['epochs'] = 5  # Fewer epochs for small dataset

with open(config_file, 'w') as f:
    yaml.dump(config, f, default_flow_style=False)

print('✅ Config ready')
"
echo ""

# Step 6: Fine-tune pix2tex
echo "🎓 Step 6: Fine-tuning pix2tex model..."
export WANDB_MODE=disabled
python3 -m pix2tex.train --config configs/train.yaml
echo ""

echo "✅ Pipeline complete!"
echo "Model saved to: checkpoints/"

