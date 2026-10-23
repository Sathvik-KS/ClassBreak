import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Minimal markdown renderer for lesson content — supports paragraphs,
 * `**bold**` spans, and `- ` bullet lists. Deliberately small: the lesson
 * schema (backend/app/models/lesson.py) only produces these constructs,
 * so we avoid pulling a full markdown library into the app bundle. */

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'heading'; text: string };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('## ') || line.startsWith('# ')) {
      blocks.push({ kind: 'heading', text: line.replace(/^#+\s*/, '') });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ kind: 'bullet', text: line.slice(2) });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }
  return blocks;
}

/** Renders `**bold**` spans as styled Text children. */
function renderInline(text: string, style: object, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={`${keyPrefix}-${i}`} style={[style, styles.bold]}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return (
      <Text key={`${keyPrefix}-${i}`} style={style}>
        {part}
      </Text>
    );
  });
}

export function MarkdownText({ markdown, fontSize = 16 }: { markdown: string; fontSize?: number }) {
  const theme = useTheme();
  const baseStyle = { color: theme.text, fontSize, lineHeight: fontSize * 1.5 };
  const blocks = parseBlocks(markdown);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <Text key={i} style={[baseStyle, styles.heading]}>
              {renderInline(block.text, baseStyle, `h${i}`)}
            </Text>
          );
        }
        if (block.kind === 'bullet') {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[baseStyle, styles.bulletMark]}>•</Text>
              <View style={styles.bulletBody}>
                <Text style={baseStyle}>
                  {renderInline(block.text, baseStyle, `b${i}`)}
                </Text>
              </View>
            </View>
          );
        }
        return (
          <Text key={i} style={[baseStyle, styles.paragraph]}>
            {renderInline(block.text, baseStyle, `p${i}`)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  paragraph: {
    marginBottom: Spacing.one,
  },
  heading: {
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  bold: {
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletMark: {
    marginTop: 1,
  },
  bulletBody: {
    flex: 1,
  },
});
