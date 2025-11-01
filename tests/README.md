# Fine-Tuning Pipeline for Handwriting Recognition

This folder contains everything needed to fine-tune OCR models (TrOCR or LaTeX-OCR/pix2tex) on your handwriting for better accuracy.

## 🎯 Two Options

### Option 1: Pix2tex (LaTeX-OCR) - Recommended for Complex Math

**Best for:** Fractions, integrals, complex mathematical expressions

```bash
cd tests
./pix2tex_pipeline.sh
```

This one command will:
1. Collect data from `../written_answers/`
2. Preprocess images
3. Convert to pix2tex format
4. Generate tokenizer
5. Create pickle datasets
6. Fine-tune pix2tex model

**Output:** `checkpoints/pix2tex/` (fine-tuned model)

---

### Option 2: TrOCR - Simpler for Digits/Simple Equations

**Best for:** Simple numbers, basic arithmetic

```bash
cd tests
pip install -r requirements.txt
./train.sh
```

Or step by step:
```bash
python scripts/01_collect_data.py    # Collect data
python scripts/02_preprocess.py      # Preprocess images
python scripts/03_finetune_trocr.py # Fine-tune TrOCR
python scripts/04_evaluate.py        # Evaluate
python scripts/05_inference.py path/to/image.png  # Test
```

**Output:** `models/trocr-finetuned/` (fine-tuned model)

---

## 📁 Folder Structure

```
tests/
├── scripts/                    # All training scripts
│   ├── 01_collect_data.py     # Collect from written_answers/
│   ├── 02_preprocess.py       # Preprocess images
│   ├── 03_finetune_trocr.py   # Fine-tune TrOCR
│   ├── 04_evaluate.py         # Evaluate performance
│   ├── 05_inference.py        # Test on new images
│   ├── 06_prepare_pix2tex_data.py  # Convert to pix2tex format
│   └── 07_create_pix2tex_dataset.py # Create pix2tex pickle files
│
├── configs/
│   └── train.yaml             # Pix2tex training config
│
├── data/                      # Source training data (generated)
│   ├── train/images/ + labels.txt
│   └── val/images/ + labels.txt
│
├── dataset/                   # Pix2tex format (generated)
│   ├── images/train/, val/
│   ├── data/*.pkl + equations.txt
│   └── tokenizer.json
│
├── checkpoints/               # Pix2tex fine-tuned models (generated)
├── models/                    # TrOCR fine-tuned models (generated)
│
├── pix2tex_pipeline.sh        # Complete pix2tex pipeline
├── train.sh                   # Complete TrOCR pipeline
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

---

## 📊 Data Format

### Source Data (Auto-Generated)

Scripts automatically create `labels.txt` files with format:
```
image_name.png\tlabel_text
```

Example:
```
addition_1_20241101_120000.png\t11
integrals_5_20241101_153029.png\t{{4/7 x^7 - 1/2 x^4 + 7/2 x^2 - 4x + c}}
```

### Pix2tex Format (Auto-Generated)

- **Equations file**: One equation per line in `dataset/data/train_equations.txt`
- **Images**: Numbered as `0.png`, `1.png`, etc. in `dataset/images/train/`
- **Pickle datasets**: `dataset/data/train.pkl`, `val.pkl`

---

## ⚙️ Configuration

### Pix2tex Config

Edit `configs/train.yaml`:
- `epochs`: Number of training epochs (default: 5)
- `batchsize`: Batch size (default: 4 for small datasets)
- `lr`: Learning rate (default: 0.001)

### TrOCR Config

Edit `config.yaml` (for TrOCR):
- `training.num_train_epochs`: Number of epochs (default: 5)
- `training.learning_rate`: Learning rate (default: 5e-5)
- `training.per_device_train_batch_size`: Batch size (default: 4)

---

## 🔧 Integration into App

After fine-tuning, update `app.py`:

### For Pix2tex:
```python
from pix2tex.api import latex
model = latex.LatexOCR()
# Load your checkpoint
model.load_checkpoint("tests/checkpoints/pix2tex/pix2tex_e05_step00.pth")
```

### For TrOCR:
```python
from transformers import VisionEncoderDecoderModel, TrOCRProcessor

model = VisionEncoderDecoderModel.from_pretrained("./tests/models/trocr-finetuned")
processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
```

---

## 💡 Tips

1. **Start small**: Even 50-100 examples can show improvement
2. **Iterate**: Run evaluation, find errors, add those examples to training
3. **Monitor**: Check training logs for progress
4. **GPU**: Training is much faster with GPU (set `gpu_devices: [0]` in config)

---

## 🐛 Troubleshooting

**Out of memory?**
- Reduce `batchsize` in config

**Low accuracy?**
- Add more training examples
- Increase `epochs`
- Adjust `lr` (try 0.0005 or 0.002)

**Training takes too long?**
- Reduce `epochs`
- Use GPU if available

**"No images found" error?**
- Make sure images are in `../written_answers/` folder
- Check image naming format: `{category}_{id}_{timestamp}.png`

---

## 📝 What Gets Generated

**Keep in Git:**
- ✅ All scripts
- ✅ Config files
- ✅ README.md

**Don't Commit (add to .gitignore):**
- ❌ `wandb/` (experiment tracking)
- ❌ `__pycache__/` (Python cache)
- ❌ `data/` (source training data - can be regenerated)
- ❌ `dataset/` (pix2tex format - can be regenerated)
- ❌ `checkpoints/` (trained models - large files)
- ❌ `models/` (trained models - large files)
