# Tests Folder Summary

## 📋 Overview

This folder contains a complete fine-tuning pipeline for handwriting recognition models. You can fine-tune either **TrOCR** (for simple math) or **pix2tex** (for complex LaTeX).

## 🚀 Quick Commands

### Pix2tex (Recommended)
```bash
cd tests && ./pix2tex_pipeline.sh
```

### TrOCR
```bash
cd tests && ./train.sh
```

## 📂 What's Inside

### ✅ Core Files (Keep)
- **`scripts/`** - All Python training scripts
  - `01_collect_data.py` - Collects from `../written_answers/`
  - `02_preprocess.py` - Image preprocessing
  - `03_finetune_trocr.py` - TrOCR fine-tuning
  - `04_evaluate.py` - Performance evaluation
  - `05_inference.py` - Test on new images
  - `06_prepare_pix2tex_data.py` - Convert to pix2tex format
  - `07_create_pix2tex_dataset.py` - Create pix2tex pickle files

- **`configs/train.yaml`** - Pix2tex training configuration
- **`pix2tex_pipeline.sh`** - Complete pix2tex pipeline script
- **`train.sh`** - Complete TrOCR pipeline script
- **`requirements.txt`** - Python dependencies
- **`README.md`** - Full documentation
- **`.gitignore`** - Prevents committing large/generated files

### 🔄 Generated Files (Auto-Created, Don't Commit)
- **`data/`** - Source training data (train/val split with labels.txt)
- **`dataset/`** - Pix2tex format (equations, numbered images, pickle files)
- **`checkpoints/`** - Fine-tuned pix2tex models (~110MB+)
- **`models/`** - Fine-tuned TrOCR models

### 🗑️ Removed (Unnecessary)
- ~~`wandb/`~~ - Experiment tracking (disabled, not needed)
- ~~`__pycache__/`~~ - Python cache (auto-generated)
- ~~`config.yaml`~~ - Duplicate config (using `configs/train.yaml` instead)
- ~~`QUICKSTART.md`~~ - Consolidated into `README.md`
- ~~`PIX2TEX_QUICKSTART.md`~~ - Consolidated into `README.md`

## 📊 Folder Size

- **Scripts**: ~40KB (essential)
- **Configs**: ~4KB (essential)
- **Generated data**: ~1.4MB (can be regenerated)
- **Pix2tex dataset**: ~220KB (can be regenerated)
- **Trained models**: ~110MB+ (don't commit!)

## 🎯 Workflow

1. **Collect Data**: Scripts auto-collect from `../written_answers/`
2. **Preprocess**: Images are resized, normalized
3. **Convert Format**: Data converted to model-specific format
4. **Fine-tune**: Model trained on your handwriting
5. **Evaluate**: Check accuracy on validation set
6. **Use**: Integrate fine-tuned model into `app.py`

## 🔍 File Purposes

| File | Purpose |
|------|---------|
| `pix2tex_pipeline.sh` | Complete pix2tex pipeline (one command) |
| `train.sh` | Complete TrOCR pipeline (one command) |
| `scripts/01_collect_data.py` | Gather images from written_answers/ |
| `scripts/02_preprocess.py` | Image preprocessing (resize, normalize) |
| `scripts/03_finetune_trocr.py` | Fine-tune TrOCR model |
| `scripts/06_prepare_pix2tex_data.py` | Convert data to pix2tex format |
| `scripts/07_create_pix2tex_dataset.py` | Create pix2tex pickle datasets |
| `configs/train.yaml` | Pix2tex training configuration |

## ✅ Clean State

- All unnecessary files removed
- Documentation consolidated
- `.gitignore` updated to prevent committing large files
- Clear separation between source code and generated files

