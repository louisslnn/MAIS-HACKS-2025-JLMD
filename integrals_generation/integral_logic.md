# Integral Generation System Logic & Prompts

## Overview

This document describes the logic and prompts for generating integral calculus problems using OpenAI API. The system creates well-formed integral problems with correct solutions in LaTeX format and adds them to `questions.json`.

## System Architecture

### Core Components

1. **IntegralGenerator Class**: Main class managing integral generation
2. **Difficulty Levels**: Predefined easy, medium, hard difficulty levels
3. **OpenAI Integration**: Uses GPT-3.5-turbo for cost-effective generation
4. **Questions.json Integration**: Automatically adds generated integrals to questions.json

---

## Data Flow

```
User Requests Generation
    ↓
Select Difficulty Level
    ↓
generate_integral() calls OpenAI API
    ↓
OpenAI returns JSON with problem & answer
    ↓
add_to_questions_json() saves to questions.json
    ↓
New integral available in questions.json
```

---

## Difficulty Levels

### Easy
- **Description**: Basic integrals (power rule, simple fractions)
- **Examples**: `∫x dx`, `∫3x² dx`, `∫(2x + 5) dx`
- **Techniques**: Direct integration, power rule only
- **Complexity**: Simple polynomials, basic functions

### Medium
- **Description**: Integration by substitution, parts, or simple fractions
- **Examples**: `∫x·e^x dx`, `∫(x²+1)/(x+1) dx`, `∫sin(x)cos(x) dx`
- **Techniques**: Substitution, integration by parts, simple partial fractions
- **Complexity**: Moderate - requires some technique selection

### Hard
- **Description**: Advanced techniques (trig substitution, partial fractions, integration by parts)
- **Examples**: `∫x²·e^x dx`, `∫1/(x²+1) dx`, `∫x³/(x+1)² dx`
- **Techniques**: Multiple steps, complex substitutions, advanced methods
- **Complexity**: Advanced - requires multiple techniques or careful manipulation

---

## Generation Prompt

### Purpose
Generate integral calculus problems with correct solutions in LaTeX format.

### Prompt Structure

```python
SYSTEM PROMPT:
"You are an expert mathematics tutor specializing in integral calculus. 
Generate well-formed integral problems with correct solutions in LaTeX format."

USER PROMPT:
"""
You are an expert mathematics tutor creating integral calculus problems.

## Task
Generate {count} integral calculus problem(s) at the **{difficulty}** difficulty level.

## Difficulty Level: {difficulty.upper()}
**Description**: {level_info['description']}
**Examples**: {', '.join(level_info['examples'])}
**Complexity**: {level_info['complexity']}

## Requirements
1. **Problem Format**: 
   - Use LaTeX notation for the integral
   - Format: `\int{{...dx}}` (use double braces for JSON compatibility)
   - Example: `\int{{4x^6 - 2x^3 + 7x - 4\,dx}}`

2. **Answer Format**:
   - Provide the complete solution in LaTeX
   - Include the integration constant `+ c` at the end
   - Use double braces: `{{...}}`
   - Format fractions as `\frac{{numerator}}{{denominator}}`
   - Example: `{{\frac{{4}}{{7}}x^7 - \frac{{1}}{{2}}x^4 + \frac{{7}}{{2}}x^2 - 4x + c}}`

3. **Difficulty Guidelines**:
   - **Easy**: Basic power rule, simple polynomials, no advanced techniques
   - **Medium**: May require substitution, integration by parts, or simple fraction decomposition
   - **Hard**: Advanced techniques like trig substitution, complex partial fractions, or multiple integration steps

4. **Variety**:
   - Make each problem unique
   - Use different functions (polynomials, exponentials, trigonometric, rational)
   - Vary the complexity appropriately for the difficulty level

## Response Format
Return a JSON array with this structure:
{
    "integrals": [
        {
            "problem": "LaTeX integral expression with double braces",
            "answer": "LaTeX solution with double braces and +c"
        }
    ]
}

## Important Notes
- Use **double braces** `{{{{` and `}}}}` in LaTeX for JSON compatibility
- Always include `+ c` in the answer
- Ensure problems are solvable and well-formed
- Use proper LaTeX syntax for all mathematical expressions
- Fraction format: `\frac{{numerator}}{{denominator}}`
- Power format: `x^{{n}}`
- Integral format: `\int{{...dx}}`

Generate {count} {difficulty} integral problem(s) now:
"""
```

### Key Features

1. **LaTeX Formatting**:
   - Double braces for JSON compatibility (`{{...}}`)
   - Proper escaping of special characters
   - Standard LaTeX math notation

2. **Difficulty Guidance**:
   - Clear instructions for each difficulty level
   - Examples to guide generation
   - Appropriate complexity requirements

3. **Quality Assurance**:
   - Ensures problems are solvable
   - Requires complete solutions
   - Includes integration constant `+c`

4. **Variety**:
   - Encourages different function types
   - Prevents repetition
   - Appropriate difficulty variation

---

## API Configuration

### Model: `gpt-3.5-turbo`
- Cost-effective for generation tasks
- Good at following structured prompts
- Adequate for LaTeX generation

### Parameters
- `temperature`: 0.8 (higher creativity for variety)
- `max_tokens`: 1500 (sufficient for problem + solution)
- `response_format`: `{"type": "json_object"}` (ensures valid JSON)

---

## Usage Examples

### Example 1: Generate Single Integral

```python
from integrals_generation.integral_generator import IntegralGenerator

generator = IntegralGenerator()

# Generate one medium difficulty integral
integral = generator.generate_integral("medium")

print(f"Problem: {integral['problem']}")
print(f"Answer: {integral['answer']}")

# Output:
# Problem: \int{{3x^2 + 2x - 5\,dx}}
# Answer: {{x^3 + x^2 - 5x + c}}
```

### Example 2: Generate and Add to questions.json

```python
generator = IntegralGenerator()

# Generate 5 medium difficulty integrals and add to questions.json
question_ids = generator.generate_and_add(
    difficulty="medium",
    count=5
)

print(f"Added {len(question_ids)} integrals with IDs: {question_ids}")
```

### Example 3: Generate Multiple Difficulties

```python
generator = IntegralGenerator()

# Generate easy integrals
easy_integrals = generator.generate_multiple_integrals("easy", count=3)

# Generate hard integrals
hard_integrals = generator.generate_multiple_integrals("hard", count=2)

# Add to questions.json
for integral in easy_integrals + hard_integrals:
    generator.add_to_questions_json(integral['problem'], integral['answer'])
```

### Example 4: List Available Difficulty Levels

```python
generator = IntegralGenerator()
levels = generator.list_difficulty_levels()

for level, info in levels.items():
    print(f"{level.upper()}: {info['description']}")
    print(f"  Examples: {', '.join(info['examples'])}")
```

---

## Questions.json Structure

Generated integrals are added to `questions.json` in this format:

```json
{
    "integrals": [
        {
            "id": 1,
            "problem": "\\int{{4x^6 - 2x^3 + 7x - 4\\,dx}}",
            "answer": "{{\\frac{4}{7}x^7 - \\frac{1}{2}x^4 + \\frac{7}{2}x^2 - 4x + c}}"
        },
        {
            "id": 2,
            "problem": "\\int{{x^2 e^x\\,dx}}",
            "answer": "{{e^x(x^2 - 2x + 2) + c}}"
        }
    ]
}
```

---

## Error Handling

The system handles:
- **Invalid difficulty**: Raises ValueError with available options
- **API failures**: Catches and reports errors
- **JSON parse errors**: Provides detailed error messages
- **Missing API key**: Clear error message with setup instructions

---

## Integration Points

### In App Flow
1. **Manual Generation**: Admin generates integrals as needed
2. **Batch Generation**: Generate multiple integrals at once
3. **Difficulty-Based**: Generate problems for specific skill levels
4. **Auto-ID Assignment**: Automatically assigns unique IDs

### Future Enhancements
- **Custom Difficulty**: Allow user-defined difficulty parameters
- **Topic-Specific**: Generate integrals for specific topics (trig, exponential, etc.)
- **Validation**: Verify generated integrals are correct before adding
- **Preview Mode**: Show generated integrals before adding to file

---

## LaTeX Formatting Standards

### Problem Format
- Integral symbol: `\int{{...}}`
- Differential: `\,dx` (with spacing)
- Double braces for JSON: `{{...}}`

### Answer Format
- Fractions: `\frac{{num}}{{den}}`
- Powers: `x^{{n}}`
- Constants: Always include `+ c`
- Double braces: `{{...}}` for JSON compatibility

### Example
```latex
Problem: \int{{4x^6 - 2x^3 + 7x - 4\,dx}}
Answer:  {{\frac{4}{7}x^7 - \frac{1}{2}x^4 + \frac{7}{2}x^2 - 4x + c}}
```

---

## Cost Optimization

### Why GPT-3.5-turbo?
- **Cost**: ~10x cheaper than GPT-4
- **Speed**: Faster generation
- **Quality**: Adequate for structured LaTeX generation

### Batch Generation
- Generate one at a time to ensure quality
- Allows error handling per integral
- Prevents token limit issues

### Caching
- Could cache generated integrals
- Reuse problems for same difficulty
- Store in temporary file before adding to questions.json

---

## Quality Assurance

### Validation Steps
1. **LaTeX Syntax**: Verify proper formatting
2. **Mathematical Correctness**: Check if solution is correct (future enhancement)
3. **Uniqueness**: Ensure no duplicates (compare with existing)
4. **Difficulty Match**: Verify difficulty level is appropriate

### Manual Review
- Generated integrals should be reviewed before use
- Check for common errors (missing +c, wrong signs, etc.)
- Verify LaTeX renders correctly

---

## Future Enhancements

1. **Auto-Validation**: Verify answers are mathematically correct
2. **Topic Filtering**: Generate integrals for specific topics
3. **Difficulty Estimation**: Auto-detect difficulty of generated integrals
4. **Preview & Edit**: Allow editing before adding to questions.json
5. **Batch Validation**: Validate multiple integrals at once
6. **Export Options**: Export to different formats (PDF, HTML, etc.)

