# Integral Generation System

This folder contains the system for automatically generating integral calculus problems using OpenAI API.

## Files

- **`integral_generator.py`**: Main Python module with `IntegralGenerator` class
- **`integral_logic.md`**: Detailed documentation of prompts and logic
- **`README.md`**: This file

## Quick Start

### Basic Usage

```python
from integrals_generation.integral_generator import IntegralGenerator

# Create generator (uses OPENAI_API_KEY from environment)
generator = IntegralGenerator()

# Generate a single medium difficulty integral
integral = generator.generate_integral("medium")
print(f"Problem: {integral['problem']}")
print(f"Answer: {integral['answer']}")

# Add to questions.json
question_id = generator.add_to_questions_json(
    problem=integral['problem'],
    answer=integral['answer']
)
```

### Generate and Add Automatically

```python
generator = IntegralGenerator()

# Generate 5 integrals and add to questions.json automatically
question_ids = generator.generate_and_add(
    difficulty="medium",
    count=5
)
```

## Difficulty Levels

- **`easy`**: Basic integrals (power rule, simple polynomials)
  - Example: `∫x dx`, `∫3x² dx`
  
- **`medium`**: Integration by substitution, parts, or simple fractions
  - Example: `∫x·e^x dx`, `∫(x²+1)/(x+1) dx`
  
- **`hard`**: Advanced techniques (trig substitution, complex partial fractions)
  - Example: `∫x²·e^x dx`, `∫1/(x²+1) dx`

## Features

- **Automatic ID Assignment**: Assigns unique IDs automatically
- **LaTeX Formatting**: Generates properly formatted LaTeX
- **questions.json Integration**: Automatically adds to questions.json
- **Multiple Difficulties**: Support for easy, medium, hard levels
- **Batch Generation**: Generate multiple integrals at once

## Requirements

- `openai` package
- `python-dotenv` package
- `OPENAI_API_KEY` environment variable

## API Model

Uses **GPT-3.5-turbo** for cost-effective generation (~10x cheaper than GPT-4).

## Example Output

```python
integral = generator.generate_integral("medium")

# Returns:
{
    "problem": "\\int{{3x^2 + 2x - 5\\,dx}}",
    "answer": "{{x^3 + x^2 - 5x + c}}"
}
```

This gets added to `questions.json` as:
```json
{
    "id": 1,
    "problem": "\\int{{3x^2 + 2x - 5\\,dx}}",
    "answer": "{{x^3 + x^2 - 5x + c}}"
}
```

## See Also

- `integral_logic.md` for detailed prompt documentation
- `integral_generator.py` for full API reference

