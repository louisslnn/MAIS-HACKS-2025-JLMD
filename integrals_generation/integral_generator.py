#!/usr/bin/env python3
"""
Integral generation system using OpenAI API.
Generates integral problems with different difficulty levels.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)


class IntegralGenerator:
    """
    Generates integral calculus problems using OpenAI API.
    """
    
    # Difficulty level definitions
    DIFFICULTY_LEVELS = {
        "easy": {
            "description": "Basic integrals (power rule, simple fractions)",
            "examples": ["∫x dx", "∫3x² dx", "∫(2x + 5) dx"],
            "complexity": "simple"
        },
        "medium": {
            "description": "Integration by substitution, parts, or simple fractions",
            "examples": ["∫x·e^x dx", "∫(x²+1)/(x+1) dx", "∫sin(x)cos(x) dx"],
            "complexity": "moderate"
        },
        "hard": {
            "description": "Advanced techniques (trig substitution, partial fractions, integration by parts)",
            "examples": ["∫x²·e^x dx", "∫1/(x²+1) dx", "∫x³/(x+1)² dx"],
            "complexity": "advanced"
        }
    }
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the integral generator.
        
        Args:
            api_key: OpenAI API key (optional, will use env var if not provided)
        """
        if not api_key:
            api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment or provided parameter")
        
        self.client = OpenAI(api_key=api_key)
        self.integrals_file = Path(__file__).parent.parent / "integrals.json"
    
    def _load_integrals(self) -> Dict:
        """Load existing integrals from integrals.json."""
        if self.integrals_file.exists():
            with open(self.integrals_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"integrals": []}
    
    def _save_integrals(self, integrals_data: Dict):
        """Save integrals to integrals.json."""
        with open(self.integrals_file, 'w', encoding='utf-8') as f:
            json.dump(integrals_data, f, indent=4, ensure_ascii=False)
    
    def _get_next_id(self, integrals_data: Dict) -> int:
        """Get the next available ID for integrals."""
        integrals = integrals_data.get("integrals", [])
        if not integrals:
            return 1
        return max(q.get("id", 0) for q in integrals) + 1
    
    def _get_generation_prompt(self, difficulty: str, count: int = 1) -> str:
        """
        Generate the prompt for OpenAI to create integral problems.
        
        Args:
            difficulty: Difficulty level ("easy", "medium", "hard")
            count: Number of integrals to generate
            
        Returns:
            Prompt string for OpenAI API
        """
        level_info = self.DIFFICULTY_LEVELS.get(difficulty, self.DIFFICULTY_LEVELS["medium"])
        
        prompt = f"""You are an expert mathematics tutor creating integral calculus problems.

## Task
Generate {count} integral calculus problem{'s' if count > 1 else ''} at the **{difficulty}** difficulty level.

## Difficulty Level: {difficulty.upper()}
**Description**: {level_info['description']}
**Examples**: {', '.join(level_info['examples'])}
**Complexity**: {level_info['complexity']}

## Requirements
1. **Problem Format**: 
   - Use LaTeX notation for the integral
   - Format: `$\\int ... \\, dx$` (use dollar signs, standard LaTeX format)
   - Example: `$\\int (4x^6 - 2x^3 + 7x - 4) \\, dx$`

2. **Answer Format**:
   - Provide the complete solution in LaTeX
   - Include the integration constant `+ c` or `+ C` at the end
   - Use dollar signs: `$...$` (standard LaTeX format, NOT double braces)
   - Format fractions as `\\frac{{numerator}}{{denominator}}`
   - Example: `$\\frac{{4}}{{7}}x^7 - \\frac{{1}}{{2}}x^4 + \\frac{{7}}{{2}}x^2 - 4x + c$`

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
{{
    "integrals": [
        {{
            "problem": "LaTeX integral expression with dollar signs",
            "answer": "LaTeX solution with dollar signs and +c or +C"
        }}
    ]
}}

## Important Notes
- Use **dollar signs** `$...$` in LaTeX for standard format (like: `$\\int x^3 \\, dx$`)
- Always include `+ c` or `+ C` in the answer
- Ensure problems are solvable and well-formed
- Use proper LaTeX syntax for all mathematical expressions
- Fraction format: `\\frac{{numerator}}{{denominator}}`
- Power format: `x^{{n}}`
- Integral format: `\\int ... \\, dx` (with spacing before dx)
- Example problem: `$\\int x^3 \\, dx$`
- Example answer: `$\\frac{{x^4}}{{4}} + c$`

Generate {count} {difficulty} integral problem{'s' if count > 1 else ''} now:"""
        
        return prompt
    
    def generate_integral(self, difficulty: str = "medium", api_key: Optional[str] = None) -> Dict:
        """
        Generate a single integral problem.
        
        Args:
            difficulty: Difficulty level ("easy", "medium", "hard")
            api_key: OpenAI API key (optional, uses instance key if not provided)
            
        Returns:
            Dict with "problem" and "answer" in LaTeX format
        """
        if difficulty not in self.DIFFICULTY_LEVELS:
            raise ValueError(f"Invalid difficulty: {difficulty}. Choose from {list(self.DIFFICULTY_LEVELS.keys())}")
        
        prompt = self._get_generation_prompt(difficulty, count=1)
        
        # Use provided API key or instance client
        client = self.client
        if api_key:
            client = OpenAI(api_key=api_key)
        
        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",  # Use cheaper model for generation
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert mathematics tutor specializing in integral calculus. Generate well-formed integral problems with correct solutions in LaTeX format."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.8,  # Higher creativity for variety
                max_tokens=1500,
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content.strip()
            result = json.loads(result_text)
            
            # Extract first integral if multiple returned
            if "integrals" in result and len(result["integrals"]) > 0:
                return result["integrals"][0]
            elif "problem" in result and "answer" in result:
                return result
            else:
                raise ValueError("Unexpected response format from OpenAI")
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse OpenAI response: {e}\nResponse: {result_text}")
        except Exception as e:
            raise RuntimeError(f"Failed to generate integral: {e}")
    
    def generate_multiple_integrals(self, difficulty: str = "medium", count: int = 5, 
                                    api_key: Optional[str] = None) -> List[Dict]:
        """
        Generate multiple integral problems.
        
        Args:
            difficulty: Difficulty level ("easy", "medium", "hard")
            count: Number of integrals to generate
            api_key: OpenAI API key (optional)
            
        Returns:
            List of dicts, each with "problem" and "answer"
        """
        if count <= 0:
            raise ValueError("Count must be positive")
        
        # Generate one at a time to ensure quality and avoid token limits
        results = []
        for i in range(count):
            try:
                integral = self.generate_integral(difficulty, api_key)
                results.append(integral)
                print(f"✓ Generated integral {i+1}/{count}")
            except Exception as e:
                print(f"✗ Failed to generate integral {i+1}: {e}")
                continue
        
        return results
    
    def add_to_integrals_json(self, problem: str, answer: str, question_id: Optional[int] = None) -> int:
        """
        Add a generated integral to integrals.json.
        
        Args:
            problem: LaTeX problem string
            answer: LaTeX answer string
            question_id: Optional ID (auto-assigned if not provided)
            
        Returns:
            The ID assigned to the question
        """
        integrals_data = self._load_integrals()
        
        # Ensure integrals array exists
        if "integrals" not in integrals_data:
            integrals_data["integrals"] = []
        
        # Get next ID
        if question_id is None:
            question_id = self._get_next_id(integrals_data)
        
        # Create question entry
        question_entry = {
            "id": question_id,
            "problem": problem,
            "answer": answer
        }
        
        # Add to integrals array
        integrals_data["integrals"].append(question_entry)
        
        # Save to file
        self._save_integrals(integrals_data)
        
        return question_id
    
    def generate_and_add(self, difficulty: str = "medium", count: int = 1, 
                        api_key: Optional[str] = None) -> List[int]:
        """
        Generate integrals and automatically add them to integrals.json.
        
        Args:
            difficulty: Difficulty level ("easy", "medium", "hard")
            count: Number of integrals to generate
            api_key: OpenAI API key (optional)
            
        Returns:
            List of question IDs that were added
        """
        # Generate integrals
        integrals = self.generate_multiple_integrals(difficulty, count, api_key)
        
        # Add to integrals.json
        question_ids = []
        for integral in integrals:
            qid = self.add_to_integrals_json(
                problem=integral["problem"],
                answer=integral["answer"]
            )
            question_ids.append(qid)
        
        return question_ids
    
    def list_difficulty_levels(self) -> Dict:
        """Return information about available difficulty levels."""
        return self.DIFFICULTY_LEVELS.copy()


# Example usage
if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("Integral Generator")
    print("=" * 60)
    
    try:
        generator = IntegralGenerator()
        difficulty = "easy"
        
        # Show available difficulty levels
        print("\nAvailable difficulty levels:")
        for level, info in generator.list_difficulty_levels().items():
            print(f"  - {level.upper()}: {info['description']}")
        
        # Example: Generate a single medium difficulty integral
        print("\n" + "=" * 60)
        print(f"Generating 1 {difficulty} difficulty integral...")
        print("=" * 60)
        
        integral = generator.generate_integral(difficulty)
        print(f"\nProblem: {integral['problem']}")
        print(f"Answer:  {integral['answer']}")
        
        # Automatically add to integrals.json
        qid = generator.add_to_integrals_json(integral['problem'], integral['answer'])
        print(f"\n✓ Added to integrals.json with ID: {qid}")
        
    except ValueError as e:
        print(f"\nError: {e}")
        print("\nMake sure OPENAI_API_KEY is set in your environment or .env file")
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()

