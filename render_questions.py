#!/usr/bin/env python3
"""
Render LaTeX math expressions from questions.json to images.
"""

import json
import random
from pathlib import Path
import matplotlib.pyplot as plt

# Configure matplotlib to use mathtext (LaTeX-like rendering)
# This works without requiring a full LaTeX installation
plt.rcParams['mathtext.fontset'] = 'stix'  # Use STIX font for better math rendering
plt.rcParams['font.size'] = 16

def clean_latex(latex_str):
    """Clean LaTeX string for matplotlib mathtext rendering."""
    # Remove unnecessary outer double braces while preserving internal structure
    cleaned = latex_str
    
    # Function to balance braces - check if removing outer braces is safe
    def has_balanced_braces(s):
        count = 0
        for char in s:
            if char == '{':
                count += 1
            elif char == '}':
                count -= 1
            if count < 0:
                return False
        return count == 0
    
    # Try to remove one layer of outer braces if present
    if cleaned.startswith('{{') and cleaned.endswith('}}'):
        # Check if removing outer layer maintains balance
        test = cleaned[1:-1]
        if has_balanced_braces(test):
            cleaned = test
    
    return cleaned

def render_question(category, question_id, problem, output_dir):
    """Render a single question to an image."""
    # Create figure with minimal margins
    fig, ax = plt.subplots(figsize=(12, 3))
    ax.axis('off')
    
    # Remove padding
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    
    # Get the problem string
    latex_expr = problem
    
    # Clean the LaTeX expression (remove $ if present, will add back if needed)
    if latex_expr.startswith('$') and latex_expr.endswith('$'):
        latex_expr = latex_expr[1:-1]
    
    cleaned_expr = clean_latex(latex_expr)
    
    # Wrap in math mode delimiters if not already present
    if not cleaned_expr.startswith('$') and not cleaned_expr.endswith('$'):
        math_expr = f"${cleaned_expr}$"
    else:
        math_expr = cleaned_expr
    
    # Try to render and save with error handling
    output_path = output_dir / f"{category}_{question_id}.png"
    
    try:
        # Render the LaTeX expression using matplotlib's mathtext
        ax.text(0.5, 0.5, math_expr, 
                horizontalalignment='center',
                verticalalignment='center',
                fontsize=24,
                transform=ax.transAxes)
        
        # Try to save - this will trigger parsing
        plt.savefig(output_path, bbox_inches='tight', pad_inches=0.3, 
                    facecolor='white', dpi=150, transparent=False)
        print(f"✓ Rendered question {question_id} to {output_path.name}")
        plt.close()
        return output_path
    except (ValueError, SyntaxError) as e:
        # Mathtext parsing error - try fallback
        error_msg = str(e)
        if 'Parse' in error_msg or 'Expected' in error_msg:
            print(f"Warning: Mathtext parsing error for question {question_id}, trying simplified version...")
        else:
            print(f"Warning: Error rendering question {question_id}: {error_msg[:100]}")
        
        # Fallback: try a simpler version by removing problematic characters
        try:
            plt.close(fig)  # Close previous figure
            fig, ax = plt.subplots(figsize=(12, 3))
            ax.axis('off')
            fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
            
            # Remove extra braces that cause issues
            simple_expr = cleaned_expr.replace('{{', '').replace('}}', '')
            # Keep single braces for subscripts/superscripts but be careful
            simple_expr = simple_expr.replace('\\\\', '\\')  # Fix double backslashes
            
            ax.text(0.5, 0.5, f"${simple_expr}$",
                    horizontalalignment='center',
                    verticalalignment='center',
                    fontsize=20,
                    transform=ax.transAxes)
            
            plt.savefig(output_path, bbox_inches='tight', pad_inches=0.3, 
                        facecolor='white', dpi=150, transparent=False)
            print(f"✓ Rendered question {question_id} (simplified) to {output_path.name}")
            plt.close()
            return output_path
        except Exception as e2:
            print(f"Error: Could not render question {question_id} with mathtext. Showing raw text.")
            plt.close(fig)  # Close previous figure
            fig, ax = plt.subplots(figsize=(12, 3))
            ax.axis('off')
            fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
            
            # Last resort: plain text representation
            display_text = latex_expr.replace('\\', '')
            ax.text(0.5, 0.5, display_text,
                    horizontalalignment='center',
                    verticalalignment='center',
                    fontsize=16,
                    family='monospace',
                    transform=ax.transAxes)
            
            plt.savefig(output_path, bbox_inches='tight', pad_inches=0.3, 
                        facecolor='white', dpi=150, transparent=False)
            print(f"⚠ Rendered question {question_id} as plain text to {output_path.name}")
            plt.close()
            return output_path
    except Exception as e:
        print(f"Error saving question {question_id}: {e}")
        plt.close()
        return None

def get_random_question(questions_data):
    """Select a random question from all categories."""
    all_questions = []
    for category, questions_list in questions_data.items():
        for q in questions_list:
            all_questions.append({
                'category': category,
                'id': q['id'],
                'problem': q['problem']
            })
    
    if not all_questions:
        return None
    
    return random.choice(all_questions)

def main():
    """Main function to render all questions."""
    # Get the script directory (use absolute path for better reliability)
    script_dir = Path(__file__).parent.absolute()
    questions_file = script_dir / "questions.json"
    
    # Check if questions.json exists
    if not questions_file.exists():
        print(f"Error: {questions_file} not found!")
        print(f"Current directory: {script_dir}")
        return
    
    # Load questions
    try:
        with open(questions_file, 'r', encoding='utf-8') as f:
            questions_data = json.load(f)
    except Exception as e:
        print(f"Error reading {questions_file}: {e}")
        return
    
    # Randomly select a question
    random_question = get_random_question(questions_data)
    if random_question:
        print(f"Randomly selected question:")
        print(f"  Category: {random_question['category']}")
        print(f"  ID: {random_question['id']}")
        print(f"  Problem: {random_question['problem']}\n")
    
    # Create output directory
    output_dir = script_dir / "rendered_questions"
    output_dir.mkdir(exist_ok=True)
    
    # Count total questions
    total_questions = sum(len(questions_list) for questions_list in questions_data.values())
    
    print(f"Rendering {total_questions} questions from {len(questions_data)} categories...")
    print(f"Output directory: {output_dir}\n")
    
    # Render each question from all categories
    rendered_files = []
    for category, questions_list in questions_data.items():
        print(f"\nRendering {category} questions...")
        for question in questions_list:
            problem = question.get('problem', '')
            if problem and problem.strip():  # Only render non-empty expressions
                try:
                    output_path = render_question(category, question['id'], problem, output_dir)
                    if output_path:
                        rendered_files.append(output_path)
                except Exception as e:
                    print(f"Error rendering {category} question {question['id']}: {e}")
            else:
                print(f"Skipping {category} question {question['id']} (empty expression)")
    
    print(f"\n✓ Successfully rendered {len(rendered_files)} questions!")
    print(f"Images saved in: {output_dir}")

if __name__ == "__main__":
    main()
