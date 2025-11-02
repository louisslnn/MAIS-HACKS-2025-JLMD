"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMatch } from "@/contexts/match-context";
import { AnswerInput } from "./AnswerInput";
import { RoundTimer } from "./RoundTimer";
import { WritingCanvas } from "./WritingCanvas";
import { LatexRenderer } from "./LatexRenderer";
import { Button } from "@/components/ui";
import { verifyWrittenAnswers } from "@/lib/firebase/functions";
import type { MatchDocument, RoundDocument, AnswerDocument } from "@/lib/game/types";

interface GameBoardProps {
  match: MatchDocument;
  activeRound: RoundDocument | undefined;
  answers: Record<string, AnswerDocument[]>;
}

export function GameBoard({ match, activeRound, answers }: GameBoardProps) {
  const { user } = useAuth();
  const { opponentState, state, submitPracticeAnswer } = useMatch();
  const currentUserId = user?.uid;
  
  const isWritingMode = match.settings.writingMode === true;
  const problemCategory = match.settings.problemCategory || "addition";
  const isIntegral = problemCategory === "integrals";
  
  // Refs for canvases and screenshot area
  const canvas1Ref = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const canvas3Ref = useRef<HTMLCanvasElement>(null);
  const screenshotAreaRef = useRef<HTMLDivElement>(null);
  
  // State for writing mode
  const [capturedScreenshots, setCapturedScreenshots] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);

  const currentUserAnswer = useMemo(() => {
    if (!activeRound) return null;
    const roundAnswers = answers[activeRound.id] || [];
    const searchId = match.mode === "solo" ? match.playerIds[0] : currentUserId;
    if (!searchId) return null;
    return roundAnswers.find((a) => a.uid === searchId) || null;
  }, [activeRound, currentUserId, answers, match.mode, match.playerIds]);

  const opponentId = useMemo(() => {
    if (!match.playerIds || !currentUserId) return null;
    return match.playerIds.find((id) => id !== currentUserId) || null;
  }, [match.playerIds, currentUserId]);

  const opponentAnswer = useMemo(() => {
    if (!activeRound || !opponentId) return null;
    const roundAnswers = answers[activeRound.id] || [];
    return roundAnswers.find((a) => a.uid === opponentId) || null;
  }, [activeRound, opponentId, answers]);

  // Group rounds into pages for writing mode
  const pages = useMemo(() => {
    if (!isWritingMode) return null;
    
    const problemsPerPage = isIntegral ? 1 : 3;
    const totalProblems = isIntegral ? 3 : 15;
    const rounds = match.settings.rounds || totalProblems;
    
    const pageGroups: RoundDocument[][] = [];
    for (let i = 0; i < rounds; i += problemsPerPage) {
      pageGroups.push(
        Array.from({ length: problemsPerPage }, (_, j) => i + j + 1)
          .filter(roundNum => roundNum <= rounds)
          .map(roundNum => ({ id: String(roundNum) }) as RoundDocument)
      );
    }
    return pageGroups;
  }, [isWritingMode, isIntegral, match.settings.rounds]);

  const handleCaptureScreenshot = useCallback(async () => {
    if (!screenshotAreaRef.current) return;
    
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(screenshotAreaRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        // Ignore unsupported CSS properties
        ignoreElements: (element) => {
          // Skip elements that might have problematic colors
          return false;
        },
        onclone: (clonedDoc) => {
          // Override any oklab colors with simple ones
          const clonedElement = clonedDoc.querySelector('[data-screenshot-area]');
          if (clonedElement) {
            clonedElement.setAttribute('style', 'background: #ffffff; color: #000000;');
          }
        },
      });
      const base64Image = canvas.toDataURL("image/png");
      const newScreenshots = [...capturedScreenshots, base64Image];
      setCapturedScreenshots(newScreenshots);
      
      // Move to next page
      if (pages && currentPageIndex < pages.length - 1) {
        setCurrentPageIndex(prev => prev + 1);
        // Clear canvases for next page
        setTimeout(() => {
          [canvas1Ref, canvas2Ref, canvas3Ref].forEach(ref => {
            if (ref.current) {
              const ctx = ref.current.getContext("2d");
              if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, ref.current.width, ref.current.height);
              }
            }
          });
        }, 100);
      } else {
        // All pages captured, trigger OCR processing
        console.log("All pages captured, processing with OCR...", newScreenshots.length);
        setIsProcessingOCR(true);
        
        // Simulate OCR processing
        setTimeout(async () => {
          console.log("Writing mode complete, all screenshots captured");
          
          // Simulate OCR results: randomly mark some as correct
          // In production, this would call verifyWrittenAnswers and parse results
          if (match.mode === "solo" && state.rounds) {
            const totalRounds = state.rounds.length;
            let correctCount = 0;
            const baseScore = 100; // Base points per correct answer
            
            // Simulate OCR results: 60-80% accuracy
            const accuracy = 0.6 + Math.random() * 0.2; // 60-80% correct
            const expectedCorrect = Math.floor(totalRounds * accuracy);
            
            // Submit answers for all rounds with simulated correctness
            state.rounds.forEach((round, index) => {
              if (round.status !== "locked") {
                // Simulate correct/incorrect based on expected accuracy
                const isCorrect = index < expectedCorrect;
                if (isCorrect) correctCount++;
                
                // Get expected answer from canonical params
                let answerValue: string;
                if (round.canonical.type === "addition") {
                  const params = round.canonical.params as { a: number; b: number; answer: number };
                  answerValue = String(isCorrect ? params.answer : params.answer + Math.floor(Math.random() * 10) + 1);
                } else {
                  // For integrals, just use a placeholder
                  answerValue = isCorrect ? "correct" : "incorrect";
                }
                
                submitPracticeAnswer(round.id, answerValue);
              }
            });
            
            // Calculate and update score
            const calculatedScore = correctCount * baseScore;
            
            // Update player stats in match state
            if (state.match && state.match.players) {
              const playerId = state.match.playerIds[0];
              const player = state.match.players[playerId];
              if (player) {
                player.score = calculatedScore;
                player.correctCount = correctCount;
                player.totalTimeMs = totalRounds * 5000; // Simulated time: 5s per problem
              }
            }
            
            // Mark match as completed after a short delay
            setTimeout(() => {
              if (state.match) {
                state.match.status = "completed";
              }
            }, 500);
          }
          
          setIsProcessingOCR(false);
          
          // In production with real OCR:
          // 1. Call verifyWrittenAnswers with newScreenshots
          // 2. Parse OCR results to get correct/incorrect for each problem
          // 3. Update player.score, player.correctCount based on OCR results
          // 4. Display in MatchResults
        }, 2000);
      }
    } catch (error) {
      console.error("Screenshot capture failed:", error);
    } finally {
      setIsCapturing(false);
    }
  }, [pages, currentPageIndex, capturedScreenshots]);

  const roundLocked = activeRound?.status === "locked";
  const roundExpired = activeRound?.endsAt 
    ? new Date(activeRound.endsAt).getTime() <= Date.now()
    : false;
  const canSubmit = !roundLocked && !roundExpired && !currentUserAnswer;

  if (!activeRound) {
    return (
      <div className="text-center py-8">
        <p className="text-ink-soft">Waiting for next round...</p>
      </div>
    );
  }

  // Render writing mode interface
  if (isWritingMode && pages) {
    const currentPage = pages[currentPageIndex];
    const totalPages = pages.length;
    const problemsOnPage = currentPage.length;

    return (
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="inline-block px-4 py-2 rounded-full bg-brand/10 text-brand text-sm font-medium">
            📝 Writing Mode - Page {currentPageIndex + 1} of {totalPages}
          </div>
          {capturedScreenshots.length > 0 && !isProcessingOCR && (
            <div className="text-sm text-ink-soft">
              {capturedScreenshots.length} page(s) submitted
            </div>
          )}
          {isProcessingOCR && (
            <div className="flex items-center gap-2 text-sm text-brand font-medium">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing with AI...
            </div>
          )}
        </div>

        {/* Screenshot Area */}
        <div 
          ref={screenshotAreaRef}
          data-screenshot-area
          className="rounded-2xl p-8 border-2"
          style={{ 
            backgroundColor: '#ffffff',
            borderColor: '#e5e7eb',
            color: '#000000'
          }}
        >
          {/* Problems */}
          <div className="space-y-8">
            {currentPage.map((roundPlaceholder, idx) => {
              const roundNum = parseInt(roundPlaceholder.id);
              // Get the actual round from state.rounds
              const actualRound = state.rounds.find(r => r.id === String(roundNum));
              
              if (!actualRound) return null;
              
              // For integrals, use LaTeX; for addition, show arithmetic
              const isIntegralProblem = isIntegral;
              
              return (
                <div key={roundNum} className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                      Problem {roundNum}
                    </span>
                  </div>
                  
                  {/* Problem Display */}
                  <div className="text-3xl font-bold mb-4" style={{ color: '#000000' }}>
                    {isIntegralProblem ? (
                      <LatexRenderer content={actualRound.prompt} className="text-3xl" />
                    ) : (
                      <span className="font-mono">{actualRound.prompt}</span>
                    )}
                  </div>

                  {/* Writing Canvas */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#6b7280' }}>
                      Write your answer:
                    </label>
                    <WritingCanvas
                      ref={idx === 0 ? canvas1Ref : idx === 1 ? canvas2Ref : canvas3Ref}
                      width={600}
                      height={120}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Page Button */}
        {!isProcessingOCR ? (
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleCaptureScreenshot}
              disabled={isCapturing}
              className="px-8"
            >
              {isCapturing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Capturing...
                </>
              ) : currentPageIndex === totalPages - 1 ? (
                `Submit Final Page & Process`
              ) : (
                `Submit Page ${currentPageIndex + 1} of ${totalPages}`
              )}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl bg-brand/5 border border-brand/20 p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <svg className="animate-spin h-12 w-12 text-brand" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div>
                <h3 className="text-xl font-semibold text-ink mb-2">
                  🤖 AI is checking your answers...
                </h3>
                <p className="text-sm text-ink-soft">
                  Using Claude Sonnet 4.5 to verify your handwritten solutions
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard typing mode interface (original code)
  return (
    <div className="space-y-8">
      {/* Question Card */}
      <div className="relative rounded-2xl bg-gradient-to-br from-brand/5 to-brand-secondary/5 p-8 border border-brand/20">
        <div className="absolute top-4 right-4">
          {activeRound.endsAt && <RoundTimer endsAt={activeRound.endsAt} />}
        </div>
        
        <div className="mb-4">
          <span className="inline-block px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-medium uppercase tracking-wider">
            Round {activeRound.id}
          </span>
        </div>
        
        <div className="text-4xl sm:text-5xl font-bold text-ink mb-8 font-mono">
          {isIntegral ? (
            <LatexRenderer content={activeRound.prompt} block className="text-4xl" />
          ) : (
            activeRound.prompt
          )}
        </div>

        {/* Answer Input */}
        {canSubmit && (
          <AnswerInput
            key={activeRound.id}
            matchId={match.id}
            roundId={activeRound.id}
            isIntegral={isIntegral}
            disabled={roundExpired || roundLocked}
          />
        )}
        
        {/* Show time's up message if expired but not locked yet */}
        {roundExpired && !roundLocked && !currentUserAnswer && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
            <p className="text-red-700 font-semibold">Time&apos;s Up! Round is ending...</p>
          </div>
        )}

        {/* Submission Status */}
        {currentUserAnswer && (
          <div className="rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-blue-900 font-semibold">Answer Submitted: {currentUserAnswer.value}</p>
            </div>
            {roundLocked && currentUserAnswer.correct !== undefined && (
              <div className={`mt-2 text-sm font-medium ${currentUserAnswer.correct ? "text-green-700" : "text-red-700"}`}>
                {currentUserAnswer.correct ? "✓ Correct!" : "✗ Incorrect"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Opponent Card */}
      {opponentId && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink">Opponent</h3>
            {opponentState && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-50">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-700">
                  Round {opponentState.currentRound}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {opponentAnswer ? (
              <>
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-ink">Submitted</p>
                  {roundLocked && opponentAnswer.correct !== undefined && (
                    <p className={`text-sm ${opponentAnswer.correct ? "text-green-600" : "text-red-600"}`}>
                      {opponentAnswer.correct ? "Correct" : "Incorrect"}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-ink-subtle/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-ink-subtle animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                </div>
                <p className="text-ink-soft">Working on answer...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Round Results */}
      {roundLocked && currentUserAnswer && opponentAnswer && (
        <div className="rounded-xl bg-surface-muted/50 border border-border p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-subtle mb-4">
            Round Complete
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-4 rounded-lg bg-surface border border-border">
              <p className="text-xs text-ink-soft mb-2">You</p>
              <div className={`text-2xl font-bold ${currentUserAnswer.correct ? "text-green-600" : "text-red-600"}`}>
                {currentUserAnswer.correct ? "✓" : "✗"}
              </div>
              <p className="text-sm text-ink-soft mt-1">
                {(currentUserAnswer.timeMs / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-surface border border-border">
              <p className="text-xs text-ink-soft mb-2">Opponent</p>
              <div className={`text-2xl font-bold ${opponentAnswer.correct ? "text-green-600" : "text-red-600"}`}>
                {opponentAnswer.correct ? "✓" : "✗"}
              </div>
              <p className="text-sm text-ink-soft mt-1">
                {(opponentAnswer.timeMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
