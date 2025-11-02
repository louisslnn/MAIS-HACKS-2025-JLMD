"use client";

import { useMemo } from "react";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

interface LatexRendererProps {
  content: string;
  block?: boolean;
  className?: string;
}

/**
 * Renders LaTeX math expressions using KaTeX
 * Handles both inline math ($...$) and display math ($$...$$)
 * Also supports raw LaTeX strings without dollar signs
 */
export function LatexRenderer({ content, block = false, className = "" }: LatexRendererProps) {
  const cleanedLatex = useMemo(() => {
    // Remove dollar signs if present
    let latex = content.trim();
    
    // Handle $$...$$ for display math
    if (latex.startsWith("$$") && latex.endsWith("$$")) {
      return latex.slice(2, -2).trim();
    }
    
    // Handle $...$ for inline math
    if (latex.startsWith("$") && latex.endsWith("$")) {
      return latex.slice(1, -1).trim();
    }
    
    // Return as-is if no dollar signs
    return latex;
  }, [content]);

  try {
    if (block) {
      return (
        <div className={className}>
          <BlockMath math={cleanedLatex} />
        </div>
      );
    }
    return (
      <span className={className}>
        <InlineMath math={cleanedLatex} />
      </span>
    );
  } catch (error) {
    console.error("LaTeX rendering error:", error);
    return <span className={`${className} text-red-600`}>{content}</span>;
  }
}

