import * as functions from "firebase-functions";
import * as fal from "@fal-ai/serverless-client";
import type { OCRVerificationResult, WritingModeSubmission } from "./lib/types";

// Configure fal.ai client
const FAL_KEY = functions.config().fal?.key;

if (FAL_KEY) {
  fal.config({
    credentials: FAL_KEY,
  });
}

interface VerifyWrittenAnswersRequest {
  submissions: WritingModeSubmission[];
}

interface VerifyWrittenAnswersResponse {
  results: OCRVerificationResult[];
  success: boolean;
  error?: string;
}

/**
 * Cloud Function to verify handwritten answers using Claude Sonnet 4.5 vision via fal.ai
 * Processes screenshots of handwritten answers and compares them against expected answers
 */
export const verifyWrittenAnswers = functions.https.onCall(
  async (
    data: VerifyWrittenAnswersRequest,
    context: functions.https.CallableContext
  ): Promise<VerifyWrittenAnswersResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to verify answers"
      );
    }

    if (!FAL_KEY) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "FAL_KEY is not configured. Set it with: firebase functions:config:set fal.key=YOUR_KEY"
      );
    }

    const { submissions } = data;

    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "submissions must be a non-empty array"
      );
    }

    try {
      const allResults: OCRVerificationResult[] = [];

      // Process each submission (page)
      for (const submission of submissions) {
        const { imageBase64, expectedAnswers } = submission;

        // Convert base64 to buffer and create Blob
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        
        // Create a Blob from the buffer
        const blob = new Blob([imageBuffer], { type: "image/png" });

        // Upload image to fal.ai
        const imageUrl = await fal.storage.upload(blob);

        // Build the prompt - OCR solves ALL problems
        const problemsInfo = expectedAnswers.map(item => {
          return {
            id: item.id,
            type: item.type,
            problem: item.problem,
            note: "You must solve this problem yourself and check if the user's answer is correct"
          };
        });
        
        const expectedStr = JSON.stringify(problemsInfo, null, 2);

        const prompt = `You are checking math answers from this image. WORK QUICKLY AND EFFICIENTLY.

Problems to Check:
${expectedStr}

For each problem in the expected list, analyze the image to determine:
1. If the problem appears in the image
2. If an answer is given in the image
3. SOLVE the problem yourself (integrals, additions, etc.)
4. Check if the user's answer matches YOUR solution
5. Whether the answer is mathematically equivalent (even if written differently)
6. Your confidence level in the verification (0.0 to 1.0)

CRITICAL - YOU MUST SOLVE ALL PROBLEMS:
- Integrals: Solve the integral from the LaTeX notation (e.g., $\\int x^3 \\, dx$ → x^4/4 + C)
- Additions: Solve the arithmetic (e.g., "45 + 23" → 68)
- Compare the user's handwritten answer with YOUR calculated solution
- Accept any mathematically equivalent form

CRITICAL - FOR ADDITION PROBLEMS ONLY:
- Addition answers MUST be pure numbers (e.g., "52", "68", "125")
- If you see letters mixed with numbers (e.g., "5a", "6b", "8s"), interpret ONLY as numbers:
  * "5a" → likely means "52" (cursive/unclear "2")
  * "8s" → likely means "85" (unclear "5")
  * Focus on the numeric digits, ignore letter-like marks
- If the answer contains ONLY letters with no clear numbers, mark as incorrect
- Be strict: Addition problems NEVER have letters in answers

IMPORTANT - EQUIVALENT ANSWERS ARE CORRECT:
- Fractions: Accept equivalent forms (e.g., 1/2 = 2/4 = 0.5 = 50%)
- Decimals: Accept fraction equivalents (e.g., 0.5 = 1/2 = 5/10)
- Simplified vs unsimplified: Accept both (e.g., 2/4 = 1/2, 4/2 = 2)
- Different notations: Accept (e.g., 2x = 2*x, x² = x^2)
- Constants: Accept (e.g., C = +C, +C = C, omitting +C is also acceptable)
- For integrals: Accept any antiderivative form (e.g., x²/2 = x^2/2 = ½x² = (1/2)x^2)
- Negative signs: Accept equivalent placement (e.g., -1/2 = -0.5 = -2/4)
- COEFFICIENT PLACEMENT (CRITICAL): Coefficient placement does NOT affect correctness. All these are EQUIVALENT and must be marked as CORRECT:
  * Examples: x^3/3 = 1/3 x^3 = (1/3)x^3 = x^3/3 = (1/3)*x^3
  * Examples: x^4/4 = 1/4 x^4 = (1/4)x^4 = 0.25x^4
  * Examples: 2x^2 = 2*x^2 = x^2*2 = (2)x^2
  * Examples: 5x = 5*x = x*5 = (5)x
  * The order of coefficient and variable term does NOT matter: "coefficient placement differs" is NOT a valid reason to mark as incorrect

CRITICAL: You MUST respond with ONLY a valid JSON object. No markdown, no code blocks, no explanatory text before or after. Your entire response must be parseable JSON.

SPEED IS PARAMOUNT: Respond as quickly as possible with minimal tokens. Skip any verbose analysis.

Required JSON structure (follow this EXACTLY):
{"results":[{"id":1,"type":"addition","is_correct":true,"confidence":1.0,"notes":""},{"id":2,"type":"multiplication","is_correct":false,"confidence":0.95,"notes":"multiplication error"}]}

Rules:
- "id" must be a string matching the problem ID
- "type" must be a string matching the problem type from the expected list (e.g., "addition", "multiplication", "integral")
- "is_correct" must be boolean (true/false, lowercase, no quotes)
  - CRITICAL: If notes contains "no answer provided", "answer box empty", "answer blank", or similar, is_correct MUST be false
  - is_correct = true when an answer is clearly visible AND either:
    * Matches the expected answer exactly, OR
    * Is mathematically equivalent to the expected answer (see EQUIVALENT ANSWERS rules above)
  - is_correct = false if: no answer visible, answer box empty, answer doesn't match AND isn't equivalent, or answer is unclear
  - When answer is equivalent but different form, set is_correct = true and confidence >= 0.8
  - NEVER mark as false due to coefficient placement differences (e.g., x^3/3 vs 1/3 x^3 are ALWAYS equivalent and both correct)
- "confidence" must be a float between 0.0 and 1.0 (how certain you are about this verification)
  - 1.0 = completely certain (problem clearly visible, answer obviously correct/incorrect)
  - 0.9 = very confident (minor ambiguity in handwriting but answer is clear)
  - 0.7-0.8 = moderately confident (some difficulty reading but likely correct assessment)
  - 0.5-0.6 = low confidence (handwriting unclear or problem partially visible)
  - 0.0-0.4 = very uncertain (problem not found or completely illegible)
  - If no answer provided, confidence should be 0.0
- "notes" must be a string
  - Use "" for empty string if answer is correct and clearly visible
  - Include notes when: answer is incorrect, no answer provided, answer box empty, or answer unclear
  - Examples: "no answer provided", "answer box empty", "wrong answer", "expected 15 got 12"
  - DO NOT mention coefficient placement differences in notes - if forms are equivalent, mark as correct with no note about placement
- Include ONLY error notes when is_correct is false
- Include ALL problems from the expected list in order
- Do NOT add any fields not specified above
- Do NOT wrap response in \`\`\`json\`\`\` or any markdown
- Do NOT add newlines, whitespace, or formatting - output compact JSON on a single line
- Minimize token usage by keeping notes brief (state problem and error)
- RESPOND AS FAST AS POSSIBLE - speed is more important than perfection

Start your response with {"results":[ and end with ]}`;

        // Call Claude Sonnet 4.5 via fal.ai
        const result = await fal.subscribe("fal-ai/any-llm/vision", {
          input: {
            model: "anthropic/claude-sonnet-4.5",
            prompt,
            image_urls: [imageUrl],
            max_tokens: 4000,
            temperature: 0.0, // Deterministic for fact-checking
          },
        });

        // Parse the response
        let responseText = (result as any).output as string;
        
        // Clean up response (remove markdown if present)
        responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        
        // Parse JSON
        const parsed = JSON.parse(responseText) as { results: Array<{
          id: string;
          type: string;
          is_correct: boolean;
          confidence: number;
          notes: string;
        }> };

        // Convert IDs to numbers and add to results
        const pageResults = parsed.results.map(r => ({
          id: parseInt(r.id, 10),
          type: r.type,
          is_correct: r.is_correct,
          confidence: r.confidence,
          notes: r.notes,
        }));

        allResults.push(...pageResults);
      }

      return {
        results: allResults,
        success: true,
      };
    } catch (error) {
      console.error("OCR verification error:", error);
      return {
        results: [],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
);

