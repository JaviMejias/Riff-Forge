const chordArtifactPattern = /["']*>+\s*(?=\[?[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m)|[0-9]|[#()+-])*(?:\/[A-G](?:#|b)?)?(?:\]|\s|\||$))/g;

export const sanitizeChordText = (content: string) => content.replace(chordArtifactPattern, '');
