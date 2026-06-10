/**
 * Restructuring helpers used by optimizeForSize / autoOptimize — pure
 * string→string transforms over CLAUDE.md content.
 *
 *   - extractRulesFromProse  (narrative prose → list-format rules)
 *   - splitOversizedSections (break sections over a line budget)
 *   - trimConstitution / trimCodeBlocks / removeDuplicateRules /
 *     trimToLineCount
 *
 * isEssentialSection is private (only the trim helpers consult it).
 *
 * Extracted from analyzer.ts (W113, P3.13 cut #3). No dependency on
 * analyze/benchmark/scoring — pure text manipulation.
 */

/**
 * Extract enforcement keywords from narrative prose into list-format rules.
 *
 * Converts patterns like:
 *   "**MCP alone does NOT execute work**"
 * Into:
 *   "- NEVER rely on MCP alone — always use Task tool for execution"
 */
export function extractRulesFromProse(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  const extractedRules: string[] = [];

  for (const line of lines) {
    result.push(line);

    // Skip lines already in list format
    if (/^\s*[-*]\s/.test(line)) continue;

    // Extract NEVER/MUST/ALWAYS from bold or plain prose
    const enforceMatch = line.match(/\*{0,2}(.*?\b(NEVER|MUST|ALWAYS|DO NOT|SHALL NOT)\b.*?)\*{0,2}/i);
    if (enforceMatch && !line.startsWith('#') && !line.startsWith('```')) {
      const statement = enforceMatch[1]
        .replace(/\*\*/g, '')
        .replace(/^\s*\d+\.\s*/, '')
        .trim();

      // Only extract if it's a meaningful standalone rule (> 10 chars, not already a list item)
      if (statement.length > 10 && !/^[-*]\s/.test(statement)) {
        extractedRules.push(`- ${statement}`);
      }
    }
  }

  // If we extracted rules, add them as a consolidated section
  if (extractedRules.length >= 3) {
    // Deduplicate
    const unique = [...new Set(extractedRules)];

    // Check if there's already an enforcement/rules section
    const hasRulesSection = /^##\s.*(rule|enforcement|constraint)/im.test(content);

    if (!hasRulesSection) {
      result.push('');
      result.push('## Enforcement Rules');
      result.push('');
      for (const rule of unique.slice(0, 15)) { // Cap at 15 extracted rules
        result.push(rule);
      }
    }
  }

  return result.join('\n');
}

/**
 * Split sections that exceed the line budget into subsections.
 */
export function splitOversizedSections(content: string, maxSectionLines: number): string {
  const lines = content.split('\n');
  const result: string[] = [];

  let currentSection: string[] = [];
  let currentHeading = '';

  function flushSection(): void {
    if (currentSection.length === 0) return;

    if (currentSection.length <= maxSectionLines || !currentHeading) {
      result.push(...currentSection);
      return;
    }

    // This section is too long — split it
    // Strategy: find natural break points (blank lines, sub-headings, list transitions)
    const subsections: string[][] = [];
    let sub: string[] = [currentSection[0]]; // Keep the heading

    for (let i = 1; i < currentSection.length; i++) {
      const line = currentSection[i];
      const isBreak = (
        (line.trim() === '' && i > 1 && currentSection[i - 1].trim() === '') ||
        /^###\s/.test(line) ||
        (line.trim() === '' && sub.length >= maxSectionLines * 0.6)
      );

      if (isBreak && sub.length > 3) {
        subsections.push(sub);
        sub = [];
      }
      sub.push(line);
    }
    if (sub.length > 0) subsections.push(sub);

    // Emit subsections
    for (let i = 0; i < subsections.length; i++) {
      result.push(...subsections[i]);
    }
  }

  for (const line of lines) {
    if (/^##\s/.test(line) && !line.startsWith('###')) {
      flushSection();
      currentSection = [line];
      currentHeading = line;
    } else {
      currentSection.push(line);
    }
  }
  flushSection();

  return result.join('\n');
}

/**
 * Trim the constitution (content before the second H2) to the budget.
 * Moves trimmed content to a new section.
 */
export function trimConstitution(content: string, maxConstitutionLines: number): string {
  const lines = content.split('\n');
  let h2Count = 0;
  let secondH2Index = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      h2Count++;
      if (h2Count === 2) {
        secondH2Index = i;
        break;
      }
    }
  }

  if (secondH2Index === -1 || secondH2Index <= maxConstitutionLines) {
    return content;
  }

  // Constitution is too long. Keep the first maxConstitutionLines, move rest after.
  const constitutionPart = lines.slice(0, maxConstitutionLines);
  const overflowPart = lines.slice(maxConstitutionLines, secondH2Index);
  const restPart = lines.slice(secondH2Index);

  // Only move if there's meaningful overflow
  const meaningfulOverflow = overflowPart.filter(l => l.trim().length > 0);
  if (meaningfulOverflow.length < 3) {
    return content;
  }

  return [
    ...constitutionPart,
    '',
    ...restPart,
    '',
    '## Extended Configuration',
    '',
    ...overflowPart,
  ].join('\n');
}

/**
 * Trim code blocks to a maximum count for compact mode.
 * Keeps the first N code blocks, replaces the rest with a comment.
 */
export function trimCodeBlocks(content: string, maxBlocks: number): string {
  let blockCount = 0;
  let insideBlock = false;
  const lines = content.split('\n');
  const result: string[] = [];
  let skipBlock = false;

  for (const line of lines) {
    if (line.startsWith('```') && !insideBlock) {
      insideBlock = true;
      blockCount++;
      if (blockCount > maxBlocks) {
        skipBlock = true;
        result.push('*(code example omitted for brevity)*');
        continue;
      }
    } else if (line.startsWith('```') && insideBlock) {
      insideBlock = false;
      if (skipBlock) {
        skipBlock = false;
        continue;
      }
    }

    if (!skipBlock) {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Remove duplicate rule statements.
 */
export function removeDuplicateRules(content: string): string {
  const lines = content.split('\n');
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    // Only deduplicate list items
    if (/^\s*[-*]\s/.test(line)) {
      const normalized = line.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(normalized)) continue;
      seen.add(normalized);
    }
    result.push(line);
  }

  return result.join('\n');
}

/**
 * Trim content to a maximum line count, preserving structure.
 * Removes the longest non-essential sections first.
 */
export function trimToLineCount(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;

  // Parse into sections
  interface Section { heading: string; lines: string[]; essential: boolean; }
  const sections: Section[] = [];
  let currentLines: string[] = [];
  let currentHeading = '';

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (currentLines.length > 0 || currentHeading) {
        const essential = isEssentialSection(currentHeading);
        sections.push({ heading: currentHeading, lines: [...currentLines], essential });
      }
      currentHeading = line;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0 || currentHeading) {
    sections.push({ heading: currentHeading, lines: [...currentLines], essential: isEssentialSection(currentHeading) });
  }

  // Sort non-essential sections by size (largest first) and trim
  let totalLines = sections.reduce((sum, s) => sum + (s.heading ? 1 : 0) + s.lines.length, 0);

  const nonEssential = sections
    .map((s, i) => ({ ...s, index: i }))
    .filter(s => !s.essential)
    .sort((a, b) => b.lines.length - a.lines.length);

  for (const s of nonEssential) {
    if (totalLines <= maxLines) break;
    const removed = s.lines.length;
    sections[s.index].lines = ['', '*(Section trimmed for context budget)*', ''];
    totalLines -= removed - 3;
  }

  // Reassemble
  const result: string[] = [];
  for (const s of sections) {
    if (s.heading) result.push(s.heading);
    result.push(...s.lines);
  }

  return result.join('\n');
}

function isEssentialSection(heading: string): boolean {
  if (!heading) return true; // Constitution is essential
  const lower = heading.toLowerCase();
  return (
    lower.includes('build') || lower.includes('test') ||
    lower.includes('security') || lower.includes('architecture') ||
    lower.includes('structure') || lower.includes('rule') ||
    lower.includes('enforcement') || lower.includes('standard')
  );
}
