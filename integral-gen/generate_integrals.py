"""
Generate calculus integral problems using fal.ai any-llm/enterprise API.

Given a difficulty description and number of problems, generates integrals
in the same JSON format as mocksheet.json.

Requires:
 - fal-client installed: pip install fal-client
 - environment variable FAL_KEY set to your fal.ai API key

Usage:
  python integral-gen/generate_integrals.py

Output:
  integral-gen/integrals.json
"""

import os
import json
from typing import Dict, Any, List

import fal_client

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

REPO_DIR = os.path.dirname(__file__)
OUTPUT_PATH = os.path.join(REPO_DIR, 'integrals.json')

# HYPERPARAMETERS - Edit these to configure generation
NUM_PROBLEMS = 30
DIFFICULTY = 'u-sub, trig intergrals, integration by parts'
MODEL = 'anthropic/claude-sonnet-4.5'
APPEND_MODE = True  # Set to True to append to existing file instead of overwriting


def get_last_id(filepath: str) -> int:
    """
    Get the last ID from existing JSON file.
    Returns 0 if file doesn't exist or is empty.
    """
    if not os.path.isfile(filepath):
        return 0
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        integrals = data.get('integrals', [])
        if not integrals:
            return 0
        
        # Find the maximum ID
        max_id = max(integral['id'] for integral in integrals)
        return max_id
    except (json.JSONDecodeError, ValueError, KeyError):
        return 0


def generate_integrals(difficulty: str, n: int, start_id: int = 1, model: str = "anthropic/claude-sonnet-4.5") -> Dict[str, Any]:
    """
    Generate N integral problems of specified difficulty using fal.ai enterprise LLM.
    
    Args:
        difficulty: Description of difficulty level (e.g., "basic polynomial integrals", 
                   "u-substitution", "integration by parts", "trigonometric integrals")
        n: Number of problems to generate
        start_id: Starting ID for problems (default: 1)
        model: Model to use for generation
    
    Returns:
        Dictionary with generated integrals
    """
    print(f"Generating {n} integrals at difficulty: {difficulty}")
    print(f"Starting from ID: {start_id}")
    print(f"Using model: {model}")
    
    end_id = start_id + n - 1
    
    prompt = f"""Generate exactly {n} calculus integral problems of difficulty: {difficulty}

For each integral, provide:
1. A LaTeX-formatted integral expression (use $ delimiters)
2. The exact answer (simplified, use LaTeX notation)

CRITICAL: Respond with ONLY a valid JSON object. No markdown, no explanations, no text before or after.

IDs must be sequential from {start_id} to {end_id}.

IMPORTANT: In JSON strings, backslashes must be escaped. Use \\\\ for LaTeX commands.

Required JSON structure (follow EXACTLY):
{{"integrals":[{{"id":{start_id},"problem":"$\\\\int x^2 \\\\, dx$","answer":"$\\\\frac{{x^3}}{{3}} + C$"}},{{"id":{start_id+1},"problem":"$\\\\int 2x \\\\, dx$","answer":"$x^2 + C$"}}]}}

Rules:
- "id" must be sequential integers starting from {start_id} to {end_id}
- "problem" must be a valid LaTeX integral expression with $ delimiters
- "answer" must be the simplified antiderivative with constant of integration C
- ALL backslashes in LaTeX must be doubled (\\\\int, \\\\frac, \\\\,) because JSON requires escaping
- Generate exactly {n} problems
- Output compact JSON on a single line
- Do NOT wrap in ```json``` or any markdown
- Vary the integrals - don't repeat patterns
- Ensure mathematical correctness

Example: For integral of x², write "problem":"$\\\\int x^2 \\\\, dx$" NOT "$\\int x^2 \\, dx$"

Start with {{"integrals":[ and end with ]}}"""

    result = fal_client.subscribe(
        "fal-ai/any-llm/enterprise",
        arguments={
            "model": model,
            "prompt": prompt,
            "temperature": 0.7,  # Some creativity for variety
            "max_tokens": 2000
        }
    )
    
    return result


def main():
    print("Integral Problem Generator")
    print(f"Generating {NUM_PROBLEMS} problems: {DIFFICULTY}")
    print(f"Output: {OUTPUT_PATH}")
    print(f"Model: {MODEL}")
    print(f"Append mode: {'ON' if APPEND_MODE else 'OFF'}")
    print()
    
    # Check for API key
    api_key = os.getenv('FAL_KEY') or os.getenv('FAL_API_KEY')
    if not api_key:
        err = {
            'error': 'FAL_KEY not found in environment variables',
            'help': 'Set your fal.ai API key in .env file or environment'
        }
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(err, f, indent=2)
        print('ERROR: Missing FAL_KEY environment variable')
        return 1
    
    os.environ['FAL_KEY'] = api_key
    
    try:
        # Determine starting ID
        if APPEND_MODE:
            last_id = get_last_id(OUTPUT_PATH)
            start_id = last_id + 1
            print(f"Found existing integrals (last ID: {last_id})")
            print(f"New IDs will start from: {start_id}")
            print()
        else:
            start_id = 1
        
        # Generate integrals
        result = generate_integrals(DIFFICULTY, NUM_PROBLEMS, start_id, MODEL)
        
        # Extract LLM output
        llm_output = result.get('output', '')
        
        print(f"\nLLM Output:\n{llm_output}\n")
        print("-" * 60)
        
        # Parse JSON from output
        try:
            # Handle potential markdown wrapping
            output_text = llm_output
            if '```json' in output_text:
                start = output_text.find('```json') + 7
                end = output_text.find('```', start)
                output_text = output_text[start:end].strip()
            elif '```' in output_text:
                start = output_text.find('```') + 3
                end = output_text.find('```', start)
                output_text = output_text[start:end].strip()
            
            parsed_data = json.loads(output_text)
            
            # Validate structure
            if 'integrals' not in parsed_data:
                raise ValueError("Response missing 'integrals' key")
            
            integrals = parsed_data['integrals']
            
            if len(integrals) != NUM_PROBLEMS:
                print(f"Warning: Expected {NUM_PROBLEMS} integrals, got {len(integrals)}")
            
            # Load existing data if appending
            if APPEND_MODE and os.path.isfile(OUTPUT_PATH):
                try:
                    with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)
                    existing_integrals = existing_data.get('integrals', [])
                    # Combine existing and new integrals
                    all_integrals = existing_integrals + integrals
                except (json.JSONDecodeError, KeyError):
                    # If file is corrupted, just use new integrals
                    all_integrals = integrals
            else:
                all_integrals = integrals
            
            # Format output to match mocksheet.json structure
            output_data = {
                "integrals": all_integrals
            }
            
            # Get the last ID for return value
            last_id = max(integral['id'] for integral in all_integrals) if all_integrals else 0
            
            # Write to file
            with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=4, ensure_ascii=False)
            
            print(f"\n✓ Generated {len(integrals)} new integrals")
            if APPEND_MODE and len(all_integrals) > len(integrals):
                print(f"✓ Total: {len(all_integrals)} integrals")
            print(f"✓ Last ID: {last_id}")
            print(f"✓ Next ID will be {last_id + 1}")
            print(f"✓ Saved to {OUTPUT_PATH}")
            print(f"\nSample new problems:")
            for i, integral in enumerate(integrals[:3], 1):
                print(f"  {integral['id']}. {integral['problem']} = {integral['answer']}")
            
            return 0
            
        except json.JSONDecodeError as e:
            err = {
                'error': f'Failed to parse JSON from LLM output: {e}',
                'llm_output': llm_output
            }
            with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
                json.dump(err, f, indent=2)
            print(f'ERROR: Could not parse JSON: {e}')
            return 1
            
    except Exception as e:
        err = {
            'error': f'Generation failed: {str(e)}',
            'type': type(e).__name__
        }
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(err, f, indent=2)
        print(f'ERROR: {e}')
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    exit(main())
