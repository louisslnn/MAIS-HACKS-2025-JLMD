integral-gen
============

Generate calculus integral problems using fal.ai any-llm/enterprise API with Claude.

Files
- `generate_integrals.py` — Main script to generate integral problems

Requirements
- Python 3.8+
- `fal-client` package
- `python-dotenv` package
- Set your fal.ai API key in `.env` file as `FAL_KEY`

Usage

Basic usage (generates 10 basic polynomial integrals):
```powershell
python .\integral-gen\generate_integrals.py
```

Append to existing file (automatically continues IDs):
```powershell
python .\integral-gen\generate_integrals.py --append -n 5
```

Specify number of problems:
```powershell
python .\integral-gen\generate_integrals.py -n 20
```

Specify difficulty level:
```powershell
python .\integral-gen\generate_integrals.py -d "u-substitution integrals"
python .\integral-gen\generate_integrals.py -d "integration by parts"
python .\integral-gen\generate_integrals.py -d "trigonometric integrals"
python .\integral-gen\generate_integrals.py -d "advanced integration techniques"
```

Custom output path:
```powershell
python .\integral-gen\generate_integrals.py -o custom_integrals.json
```

All options:
```powershell
python .\integral-gen\generate_integrals.py -n 15 -d "exponential and logarithmic integrals" -o my_integrals.json
```

Command-line Arguments
- `-n, --num` — Number of problems to generate (default: 10)
- `-d, --difficulty` — Difficulty description (default: "basic polynomial integrals")
- `-m, --model` — Model to use (default: anthropic/claude-sonnet-4.5)
- `-o, --output` — Output file path (default: integral-gen/integrals.json)
- `--append` — Append to existing file instead of overwriting (IDs continue from last)

Output Format

Generated JSON matches the mocksheet.json structure:
```json
{
  "integrals": [
    {
      "id": 1,
      "problem": "$\\int x^2 \\, dx$",
      "answer": "$\\frac{x^3}{3} + C$"
    },
    {
      "id": 2,
      "problem": "$\\int 2x \\, dx$",
      "answer": "$x^2 + C$"
    }
  ]
}
```

Example Difficulty Levels
- "basic polynomial integrals" — Simple power rule integrals
- "u-substitution" — Integrals requiring substitution
- "integration by parts" — Integrals using IBP
- "trigonometric integrals" — Trig function integrals
- "rational functions" — Partial fraction decomposition
- "exponential and logarithmic" — e^x and ln(x) integrals
- "mixed difficulty calculus 1" — Variety of first-year calculus integrals

Notes
- Uses Claude Sonnet 4.5 by default for high-quality mathematical generation
- Automatically loads API key from `.env` file
- Output includes LaTeX formatting for proper mathematical rendering
- Temperature set to 0.7 for variety while maintaining correctness
- IDs are automatically tracked and incremented when using `--append`
- The script returns the last ID used, allowing you to track progress
- Without `--append`, the file will be overwritten starting from ID 1
