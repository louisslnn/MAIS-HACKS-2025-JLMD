import random
import json
import os

N = 10
LOW = 1
HIGH = 20
OP = 'addition'  # 'multiplication' or 'addition'
OUT_PATH = 'question-gen/questions.json'

def generate_questions(n, low, high, op='multiplication', out_path=None, randomize=False, seed=None):
    """Public helper that generates questions and optionally writes them to a JSON file.

    Parameters:
      - n, low, high, op: generation parameters (see _build_questions)
      - out_path: if provided, write JSON to this path and return the path
      - randomize: if True, sample operand pairs randomly (without replacement when possible)
      - seed: optional int seed for reproducible randomness

    Returns:
      - If out_path provided: returns out_path (string)
      - Else: returns a dict {op: [questions...]}
    """
    # validate same rules as the builder
    if not isinstance(n, int) or n <= 0:
        raise ValueError('n must be a positive integer')
    if not (isinstance(low, int) and isinstance(high, int)):
        raise ValueError('low and high must be integers')
    if low > high:
        raise ValueError('low must be <= high')
    if op not in ('multiplication', 'addition'):
        raise ValueError("op must be 'multiplication' or 'addition'")

    if seed is not None:
        random.seed(seed)

    pool = [(a, b) for a in range(low, high + 1) for b in range(low, high + 1)]

    if randomize:
        if n <= len(pool):
            chosen = random.sample(pool, n)
        else:
            chosen = [random.choice(pool) for _ in range(n)]
    else:
        # deterministic cycling
        chosen = []
        idx = 0
        while len(chosen) < n:
            chosen.append(pool[idx % len(pool)])
            idx += 1

    questions = []
    for i, (a, b) in enumerate(chosen):
        if op == 'multiplication':
            prob = f"${a} \\times {b}$"
            ans = a * b
        else:
            prob = f"${a} + {b}$"
            ans = a + b
        questions.append({'id': i + 1, 'problem': prob, 'answer': ans})

    if out_path:
        parent = os.path.dirname(out_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump({op: questions}, f, ensure_ascii=False, indent=2)
        return out_path
    return {op: questions}


def write_questions_to_file(n, low, high, op, out_path):
    """Generate questions and write them to out_path as a JSON object labeled by op."""
    # use the public generate_questions with deterministic behavior
    return generate_questions(n, low, high, op=op, out_path=out_path, randomize=False, seed=None)


# Run when executed as a script
if __name__ == '__main__':
    # additional runtime hyperparameters for randomness
    RANDOMIZE = True  # if True, sample randomly from available ordered pairs
    SEED = None        # set to an int for reproducible generation, or None for system seed

    try:
        result = generate_questions(N, LOW, HIGH, op=OP, out_path=OUT_PATH, randomize=RANDOMIZE, seed=SEED)
        print('Wrote questions to:', result if isinstance(result, str) else OUT_PATH)
    except Exception as e:
        print('Error generating questions:', e)
