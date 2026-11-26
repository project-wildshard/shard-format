// The docs site's Markdown renderer (format.wildshard.io, ask A3). A small CommonMark/GFM subset, exactly what docs/
// uses: ATX headings, paragraphs, fenced code, block quotes, nested lists, GFM tables, rules, HTML comments (dropped);
// inline code, emphasis, strong, strike, links and autolinks. Raw HTML is never passed through: it is escaped, so a
// doc can't inject markup into the page. No dependency on purpose (package.json changes need Jake's sign-off).
//
//   renderMarkdown(text, { link }) -> { html, headings }
//
// `link(href)` maps each link target: a string is the href to write, null drops the link and keeps its text.

const LIST_ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])( +|$)(.*)$/;
const FENCE = /^( {0,3})(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const TABLE_RULE = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const BLANK = /^\s*$/;

/** @param {string} text */
export function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to dashes. @param {string} text */
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, '')
    .replaceAll(/\s/gu, '-');
}

/** Plain text of an inline Markdown run, for anchors and titles. @param {string} text */
export function plainText(text) {
  return text
    .replaceAll(/`+([^`]*)`+/g, '$1')
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replaceAll(/(^|\W)[*_](\S(?:.*?\S)?)[*_](?=\W|$)/g, '$1$2')
    .replaceAll(/\\(.)/g, '$1');
}

/** @param {string} line */
function indentOf(line) {
  let width = 0;
  for (const char of line) {
    if (char === ' ') width += 1;
    else if (char === '\t') width += 4 - (width % 4);
    else break;
  }
  return width;
}

/** Removes up to `width` columns of leading indentation. @param {string} line @param {number} width */
function dedent(line, width) {
  let index = 0;
  let removed = 0;
  while (index < line.length && removed < width) {
    if (line[index] === ' ') removed += 1;
    else if (line[index] === '\t') removed += 4 - (removed % 4);
    else break;
    index += 1;
  }
  return line.slice(index);
}

/** @param {string} line */
function splitRow(line) {
  let body = line.trim();
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1);
  const cells = [];
  let cell = '';
  let code = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '\\' && body[index + 1] === '|') {
      cell += '|';
      index += 1;
    } else if (char === '`') {
      cell += char;
      code = code === 0 ? 1 : 0;
    } else if (char === '|' && code === 0) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** @param {string} line */
function startsBlock(line) {
  return HEADING.test(line) || FENCE.test(line) || RULE.test(line) || /^ {0,3}>/.test(line) || LIST_ITEM.test(line);
}

/**
 * @typedef {{ type: 'heading', level: number, text: string }
 *   | { type: 'code', lang: string, text: string }
 *   | { type: 'quote', blocks: Block[] }
 *   | { type: 'list', ordered: boolean, start: number, tight: boolean, items: Block[][] }
 *   | { type: 'table', align: string[], head: string[], rows: string[][] }
 *   | { type: 'rule' }
 *   | { type: 'paragraph', text: string }} Block
 */

/** @param {string[]} lines @returns {Block[]} */
export function parseBlocks(lines) {
  /** @type {Block[]} */
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (BLANK.test(line)) {
      index += 1;
      continue;
    }
    if (/^ {0,3}<!--/.test(line)) {
      while (index < lines.length && !(lines[index] ?? '').includes('-->')) index += 1;
      index += 1;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const [, indent = '', marker = '```', lang = ''] = fence;
      const body = [];
      index += 1;
      while (index < lines.length) {
        const next = lines[index] ?? '';
        const close = /^\s*(`{3,}|~{3,})\s*$/.exec(next)?.[1] ?? '';
        if (close[0] === marker[0] && close.length >= marker.length) {
          index += 1;
          break;
        }
        body.push(dedent(next, indent.length));
        index += 1;
      }
      blocks.push({ type: 'code', lang, text: body.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1]?.length ?? 1, text: heading[2] ?? '' });
      index += 1;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }
    if (/^ {0,3}>/.test(line)) {
      const body = [];
      while (index < lines.length && !BLANK.test(lines[index] ?? '')) {
        const next = lines[index] ?? '';
        if (!/^ {0,3}>/.test(next) && startsBlock(next)) break;
        body.push(next.replace(/^ {0,3}> ?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(body) });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const list = parseList(lines, index);
      blocks.push(list.block);
      index = list.next;
      continue;
    }
    const nextLine = lines[index + 1] ?? '';
    if (line.includes('|') && TABLE_RULE.test(nextLine) && nextLine.includes('-')) {
      const head = splitRow(line);
      const align = splitRow(nextLine).map(cell => {
        if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
        if (cell.endsWith(':')) return 'right';
        if (cell.startsWith(':')) return 'left';
        return '';
      });
      const rows = [];
      index += 2;
      while (index < lines.length && !BLANK.test(lines[index] ?? '') && (lines[index] ?? '').includes('|')) {
        rows.push(splitRow(lines[index] ?? ''));
        index += 1;
      }
      blocks.push({ type: 'table', align, head, rows });
      continue;
    }
    const body = [line.trim()];
    index += 1;
    while (index < lines.length) {
      const next = lines[index] ?? '';
      if (BLANK.test(next) || startsBlock(next) || /^ {0,3}<!--/.test(next)) break;
      if (next.includes('|') && TABLE_RULE.test(lines[index + 1] ?? '') && (lines[index + 1] ?? '').includes('-')) break;
      body.push(next.trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: body.join('\n') });
  }
  return blocks;
}

/** @param {string[]} lines @param {number} start @returns {{ block: Block, next: number }} */
function parseList(lines, start) {
  const first = LIST_ITEM.exec(lines[start] ?? '');
  const marker = first?.[2] ?? '-';
  const ordered = /\d/.test(marker);
  const base = indentOf(lines[start] ?? '');
  /** @type {Block[][]} */
  const items = [];
  let tight = true;
  let index = start;
  while (index < lines.length) {
    const match = LIST_ITEM.exec(lines[index] ?? '');
    if (!match || indentOf(lines[index] ?? '') !== base) break;
    const sameKind = ordered ? /\d/.test(match[2] ?? '') : match[2] === marker;
    if (!sameKind) break;
    const content = (match[1]?.length ?? 0) + (match[2]?.length ?? 0) + Math.max(1, Math.min(4, match[3]?.length ?? 1));
    const body = [match[4] ?? ''];
    index += 1;
    let blankRun = false;
    while (index < lines.length) {
      const next = lines[index] ?? '';
      if (BLANK.test(next)) {
        body.push('');
        blankRun = true;
        index += 1;
        continue;
      }
      if (indentOf(next) >= content) {
        if (blankRun) tight = false;
        body.push(dedent(next, content));
        blankRun = false;
        index += 1;
        continue;
      }
      if (!blankRun && !startsBlock(next) && !LIST_ITEM.test(next)) {
        body.push(next.trim());
        index += 1;
        continue;
      }
      break;
    }
    while (body.length > 0 && body.at(-1) === '') body.pop();
    if (blankRun && index < lines.length) {
      const next = LIST_ITEM.exec(lines[index] ?? '');
      if (next && indentOf(lines[index] ?? '') === base) tight = false;
    }
    items.push(parseBlocks(body));
  }
  const startNumber = ordered ? Number.parseInt(marker, 10) : 1;
  return { block: { type: 'list', ordered, start: startNumber, tight, items }, next: index };
}

/**
 * @typedef {{ link: (href: string) => string | null, inLink?: boolean }} RenderOptions
 */

/** @param {string} text @param {RenderOptions} options */
export function renderInline(text, options) {
  let out = '';
  let index = 0;
  const length = text.length;
  while (index < length) {
    const char = text[index] ?? '';
    if (char === '\\' && index + 1 < length && /[!-/:-@[-`{-~]/.test(text[index + 1] ?? '')) {
      out += escapeHtml(text[index + 1] ?? '');
      index += 2;
      continue;
    }
    if (char === '`') {
      let run = 0;
      while (text[index + run] === '`') run += 1;
      const ticks = '`'.repeat(run);
      const close = text.indexOf(ticks, index + run);
      if (close !== -1 && text[close + run] !== '`') {
        let code = text.slice(index + run, close).replaceAll('\n', ' ');
        if (code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') code = code.slice(1, -1);
        out += `<code>${escapeHtml(code)}</code>`;
        index = close + run;
        continue;
      }
      out += ticks;
      index += run;
      continue;
    }
    if (char === '<') {
      const auto = /^<(https?:\/\/[^\s<>]+)>/.exec(text.slice(index));
      if (auto) {
        const href = options.link(auto[1] ?? '');
        out += href === null ? escapeHtml(auto[1] ?? '') : `<a href="${escapeHtml(href)}">${escapeHtml(auto[1] ?? '')}</a>`;
        index += auto[0].length;
        continue;
      }
    }
    if (char === 'h' && !options.inLink && !/[\w/]/.test(text[index - 1] ?? '')) {
      const bare = /^https?:\/\/[^\s<>`]*[^\s<>`.,;:!?)'"*_]/.exec(text.slice(index));
      if (bare) {
        const href = options.link(bare[0]);
        out += href === null ? escapeHtml(bare[0]) : `<a href="${escapeHtml(href)}">${escapeHtml(bare[0])}</a>`;
        index += bare[0].length;
        continue;
      }
    }
    if (char === '[' || (char === '!' && text[index + 1] === '[')) {
      const image = char === '!';
      const link = matchLink(text, image ? index + 1 : index);
      if (link) {
        const label = renderInline(link.label, { ...options, inLink: true });
        const href = options.link(link.href);
        if (image) {
          out += href === null ? label : `<img src="${escapeHtml(href)}" alt="${escapeHtml(plainText(link.label))}" loading="lazy">`;
        } else {
          out += href === null ? label : `<a href="${escapeHtml(href)}">${label}</a>`;
        }
        index = link.end;
        continue;
      }
    }
    const strong = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(text.slice(index));
    if (strong && (strong[1] === '**' || !/\w/.test(text[index - 1] ?? ''))) {
      out += `<strong>${renderInline(strong[2] ?? '', options)}</strong>`;
      index += strong[0].length;
      continue;
    }
    const strike = /^~~(?=\S)([\s\S]*?\S)~~/.exec(text.slice(index));
    if (strike) {
      out += `<del>${renderInline(strike[1] ?? '', options)}</del>`;
      index += strike[0].length;
      continue;
    }
    if ((char === '*' || char === '_') && text[index + 1] !== char) {
      const rest = text.slice(index + 1);
      const em = char === '*' ? /^(?=\S)((?:\\.|[^*\\])*?\S)\*(?!\*)/.exec(rest) : /^(?=\S)((?:\\.|[^_\\])*?\S)_(?!\w)/.exec(rest);
      const opens = char === '*' || !/\w/.test(text[index - 1] ?? '');
      if (em && opens) {
        out += `<em>${renderInline(em[1] ?? '', options)}</em>`;
        index += em[0].length + 1;
        continue;
      }
    }
    out += escapeHtml(char);
    index += 1;
  }
  return out;
}

/** `[label](href "title")` at `start`. @param {string} text @param {number} start */
function matchLink(text, start) {
  let depth = 0;
  let index = start;
  for (; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') index += 1;
    else if (char === '`') {
      const close = text.indexOf('`', index + 1);
      if (close !== -1) index = close;
    } else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (text[index] !== ']' || text[index + 1] !== '(') return null;
  const target = /^\(\s*<?([^\s<>()]*(?:\([^\s()]*\)[^\s<>()]*)*)>?(?:\s+"[^"]*")?\s*\)/.exec(text.slice(index + 1));
  if (!target) return null;
  return { label: text.slice(start + 1, index), href: target[1] ?? '', end: index + 1 + target[0].length };
}

/**
 * @param {string} markdown
 * @param {RenderOptions} options
 * @returns {{ html: string, headings: { level: number, id: string, text: string }[] }}
 */
export function renderMarkdown(markdown, options) {
  const blocks = parseBlocks(markdown.replaceAll('\r\n', '\n').split('\n'));
  /** @type {{ level: number, id: string, text: string }[]} */
  const headings = [];
  /** @type {Map<string, number>} */
  const seen = new Map();
  /** @param {Block[]} list @param {boolean} tight @returns {string} */
  const render = (list, tight) =>
    list
      .map(block => {
        switch (block.type) {
          case 'heading': {
            const text = plainText(block.text);
            const base = slugify(text) || 'section';
            const count = seen.get(base) ?? 0;
            seen.set(base, count + 1);
            const id = count === 0 ? base : `${base}-${count}`;
            headings.push({ level: block.level, id, text });
            const inner = renderInline(block.text, options);
            return `<h${block.level} id="${escapeHtml(id)}"><a class="anchor" href="#${escapeHtml(id)}" aria-hidden="true">#</a>${inner}</h${block.level}>`;
          }
          case 'code': {
            const lang = block.lang ? ` class="language-${escapeHtml(block.lang)}"` : '';
            return `<pre><code${lang}>${escapeHtml(block.text)}</code></pre>`;
          }
          case 'quote':
            return `<blockquote>${render(block.blocks, false)}</blockquote>`;
          case 'list': {
            const tag = block.ordered ? 'ol' : 'ul';
            const start = block.ordered && block.start !== 1 ? ` start="${block.start}"` : '';
            const items = block.items.map(item => `<li>${render(item, block.tight)}</li>`).join('');
            return `<${tag}${start}>${items}</${tag}>`;
          }
          case 'table': {
            /** @param {number} column */
            const style = column => (block.align[column] ? ` style="text-align:${block.align[column]}"` : '');
            const head = block.head.map((cell, column) => `<th${style(column)}>${renderInline(cell, options)}</th>`).join('');
            const rows = block.rows
              .map(row => `<tr>${block.head.map((_, column) => `<td${style(column)}>${renderInline(row[column] ?? '', options)}</td>`).join('')}</tr>`)
              .join('');
            return `<div class="table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
          }
          case 'rule':
            return '<hr>';
          case 'paragraph': {
            const inner = renderInline(block.text, options);
            return tight ? inner : `<p>${inner}</p>`;
          }
          default:
            return '';
        }
      })
      .join('\n');
  return { html: render(blocks, false), headings };
}
