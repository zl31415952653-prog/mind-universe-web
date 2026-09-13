import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Root, Text } from 'mdast';
import { Link } from 'react-router-dom';
import { findEntryByTitle } from '../links';
import type { Entry } from '../types';

/**
 * Markdown 渲染 + [[双链]] 支持：
 * 把正文中的 [[标题]] 文本节点转换为 wiki: 链接，命中已有条目时渲染为
 * 内部跳转链接，未命中的以虚线样式提示（仍可稍后创建该标题的条目）。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
function wikiLinks() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index: number | undefined, parent: any) => {
      if (index === undefined || !parent) return;
      const re = /\[\[([^\[\]]+)\]\]/g;
      const parts: any[] = [];
      let m: RegExpExecArray | null;
      let last = 0;
      while ((m = re.exec(node.value)) !== null) {
        if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
        parts.push({
          type: 'link',
          url: 'wiki:' + encodeURIComponent(m[1].trim()),
          children: [{ type: 'text', value: m[1].trim() }],
        });
        last = m.index + m[0].length;
      }
      if (parts.length === 0) return;
      if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
    });
  };
}

export default function Markdown({ content, entries }: { content: string; entries: Entry[] }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, wikiLinks]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('wiki:')) {
              const title = decodeURIComponent(href.slice(5));
              const target = findEntryByTitle(entries, title);
              return target
                ? <Link className="wiki-link" to={'/experience/' + target.id}>{children}</Link>
                : <span className="wiki-link missing" title={`尚未创建题为「${title}」的条目`}>{children}</span>;
            }
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
