"""
Use fal.ai API to check math answers from an image using Claude Sonnet 4.5 vision model.

Uses fal-ai/any-llm/vision with Claude to directly analyze the image and verify
answers against mocksheet.json without needing separate OCR.

Requires:
 - fal-client installed: pip install fal-client
 - environment variable FAL_KEY set to your fal.ai API key

Usage:
  # with venv activated in repo root
  python claude-checker/fal_check_answers.py

Output:
  claude-checker/results.json
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
    pass  # dotenv not installed, will use system environment variables

REPO_DIR = os.path.dirname(__file__)
IMAGE_PATH = os.path.join(REPO_DIR, 'testsheet.jpg')
EXPECTED_PATH = os.path.join(REPO_DIR, 'mocksheet.json')
OUTPUT_PATH = os.path.join(REPO_DIR, 'results.json')


def verify_answers_with_vision(image_path: str, expected_problems: List[Dict]) -> Dict[str, Any]:
    """
    Use fal-ai/any-llm/vision with Claude Sonnet 4.5 to analyze the image
    and verify answers against expected problems
    """
    print(f"Analyzing image with Claude Sonnet 4.5...")
    
    # Upload the image to fal.ai and get URL
    image_url = fal_client.upload_file(image_path)
    
    # Build the prompt with expected answers
    expected_str = json.dumps(expected_problems, indent=2)
    
    prompt = f"""You are checking math answers from this image. WORK QUICKLY AND EFFICIENTLY.

Expected Problems and Answers:
{expected_str}

For each problem in the expected list, analyze the image to determine:
1. If the problem appears in the image
2. If an answer is given in the image
3. If that answer matches the expected answer

CRITICAL: You MUST respond with ONLY a valid JSON object. No markdown, no code blocks, no explanatory text before or after. Your entire response must be parseable JSON.

SPEED IS PARAMOUNT: Respond as quickly as possible with minimal tokens. Skip any verbose analysis.

Required JSON structure (follow this EXACTLY):
{{"results":[{{"id":1,"is_correct":true,"found_in_image":true,"notes":""}},{{"id":2,"is_correct":false,"found_in_image":true,"notes":"addition error"}}]}}

Rules:
- "id" must be an integer matching the problem ID
- "is_correct" must be boolean (true/false, lowercase, no quotes)
- "found_in_image" must be boolean (true/false, lowercase, no quotes)
- "notes" must be a string (use "" for empty string if answer is correct)
- Include ONLY error notes when is_correct is false
- Include ALL problems from the expected list in order
- Do NOT add any fields not specified above
- Do NOT wrap response in ```json``` or any markdown
- Do NOT add newlines, whitespace, or formatting - output compact JSON on a single line
- Minimize token usage by keeping notes brief (state problem and error)
- RESPOND AS FAST AS POSSIBLE - speed is more important than perfection

Start your response with {{"results":[ and end with ]}}"""

    # Call Claude Sonnet 4.5 via fal.ai vision API
    result = fal_client.subscribe(
        "fal-ai/any-llm/vision",
        arguments={
            "model": "anthropic/claude-sonnet-4.5",
            "prompt": prompt,
            "image_urls": [image_url],
            "max_tokens": 4000,
            "temperature": 0.0  # Deterministic for fact-checking
        }
    )
    
    return result


def main():
    # Check for API key
    api_key = os.getenv('FAL_KEY') or os.getenv('FAL_API_KEY')
    if not api_key:
        err = {
            'error': 'FAL_KEY not found in environment variables',
            'help': 'Set your fal.ai API key: $env:FAL_KEY = "your-key-here"'
        }
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(err, f, indent=2)
        print('ERROR: Missing FAL_KEY environment variable')
        print('Get your key from https://fal.ai/dashboard/keys')
        return 1

    # Set the API key for fal_client
    os.environ['FAL_KEY'] = api_key

    # Check files exist
    if not os.path.isfile(IMAGE_PATH):
        err = {'error': f'Image not found: {IMAGE_PATH}'}
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(err, f, indent=2)
        print(f'ERROR: Image not found: {IMAGE_PATH}')
        return 1

    if not os.path.isfile(EXPECTED_PATH):
        err = {'error': f'Expected JSON not found: {EXPECTED_PATH}'}
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(err, f, indent=2)
        print(f'ERROR: Expected JSON not found: {EXPECTED_PATH}')
        return 1

    try:
        # Load expected answers
        with open(EXPECTED_PATH, 'r', encoding='utf-8') as f:
            expected_data = json.load(f)
        
        # Flatten expected data into a list
        expected_problems = []
        for problem_type, problems in expected_data.items():
            for prob in problems:
                expected_problems.append({
                    'id': prob['id'],
                    'type': problem_type,
                    'problem': prob['problem'],
                    'answer': prob['answer']
                })

        # Analyze image with Claude vision model
        vision_result = verify_answers_with_vision(IMAGE_PATH, expected_problems)
        
        # Extract Claude's response
        claude_output = vision_result.get('output', '')
        
        print(f"\nClaude's Analysis:\n{claude_output}\n")
        print("-" * 60)

        # Build final results
        results = {
            'model': 'anthropic/claude-sonnet-4.5 (via fal-ai/any-llm/vision)',
            'image_analyzed': IMAGE_PATH,
            'claude_response': claude_output,
            'raw_result': vision_result
        }

        # Try to extract JSON from Claude's response
        try:
            # Claude might wrap JSON in markdown code blocks
            claude_text = claude_output
            if '```json' in claude_text:
                start = claude_text.find('```json') + 7
                end = claude_text.find('```', start)
                claude_text = claude_text[start:end].strip()
            elif '```' in claude_text:
                start = claude_text.find('```') + 3
                end = claude_text.find('```', start)
                claude_text = claude_text[start:end].strip()
            
            parsed_results = json.loads(claude_text)
            results['verification_results'] = parsed_results
        except Exception as e:
            results['parsing_note'] = f'Could not parse JSON from Claude response: {e}'

        # Write results
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f'\n✓ Success! Results written to {OUTPUT_PATH}')
        
        # Print summary
        if 'verification_results' in results:
            verification = results['verification_results'].get('results', [])
            correct_count = sum(1 for r in verification if r.get('is_correct'))
            found_count = sum(1 for r in verification if r.get('found_in_image'))
            print(f'✓ Analyzed {len(verification)} problems')
            print(f'✓ Found in image: {found_count}/{len(verification)}')
            print(f'✓ Correct answers: {correct_count}/{len(verification)}')
        
        return 0

    except Exception as e:
        err = {
            'error': f'Processing failed: {str(e)}',
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
