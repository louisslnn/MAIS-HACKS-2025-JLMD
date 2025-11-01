claude-checker
===============

Automated math worksheet verification using Claude Sonnet 4.5 vision model via fal.ai API.

Files
- `fal_check_answers.py` — Main script using Claude vision to verify answers from images
- `fal_efficient_check.py` — Cost-optimized alternative using GOT-OCR + regex parsing
- `check_answers.py` — Legacy Anthropic SDK implementation (deprecated)

Requirements
- Python 3.8+
- `fal-client` package
- `python-dotenv` package
- Set your fal.ai API key in `.env` file as `FAL_KEY` or environment variable

Setup

1. Install dependencies:
```powershell
pip install fal-client python-dotenv
```

2. Create `.env` file in repository root:
```
FAL_KEY=your-fal-api-key-here
```

Get your API key from https://fal.ai/dashboard/keys

Usage

Run from command line (uses testsheet.jpg and mocksheet.json by default):
```powershell
python .\claude-checker\fal_check_answers.py
```

Expected JSON format:
```json
{
  "addition": [
    {"id": 1, "problem": "$3 + 8$", "answer": "11"},
    {"id": 2, "problem": "$2 + 8$", "answer": "10"}
  ]
}
```

Output format (results.json):
```json
{
  "model": "anthropic/claude-sonnet-4.5 (via fal-ai/any-llm/vision)",
  "image_analyzed": "path/to/image.jpg",
  "verification_results": {
    "results": [
      {"id": 1, "is_correct": true, "found_in_image": true, "notes": ""},
      {"id": 2, "is_correct": false, "found_in_image": true, "notes": "wrong answer"}
    ]
  }
}
```

Efficient Alternative

For faster, cheaper processing on clear worksheets:
```powershell
python .\claude-checker\fal_efficient_check.py
```

Uses GOT-OCR for text extraction and regex parsing instead of vision model reasoning. Approximately 10x cheaper and 5x faster than Claude vision.

Notes
- Claude vision provides highest accuracy for messy handwriting and complex problems
- Efficient mode works best for typed or clearly handwritten worksheets
- All scripts automatically load environment variables from `.env` file
- Do not commit API keys to version control
