import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React from 'react';

function flatten(text, child) {
  return typeof child === 'string'
    ? text + child
    : React.Children.toArray(child.props.children).reduce(flatten, text);
}

function HeadingRenderer({ level, children, ...props }) {
  const Tag = `h${level}`;
  const id = React.Children.toArray(children).reduce(flatten, '').replace(/\s+/g, '-').toLowerCase();

  const styles = {
    1: 'text-3xl font-extrabold text-gray-900 mt-7 mb-4 pb-2 border-b-2 border-orange-400',
    2: 'text-2xl font-bold text-gray-900 mt-6 mb-3 pb-1.5 border-b border-orange-200',
    3: 'text-xl font-semibold text-gray-800 mt-5 mb-2.5 pl-3 border-l-4 border-orange-400',
    4: 'text-base font-semibold text-gray-800 mt-3 mb-1.5',
    5: 'text-sm font-semibold text-gray-700 mt-3 mb-1',
    6: 'text-sm font-medium text-gray-600 mt-3 mb-1',
  };

  return <Tag id={id} className={styles[level] || ''} {...props}>{children}</Tag>;
}

function ParagraphRenderer({ children }) {
  return (
    <p className="my-3 text-gray-800 leading-8">
      {children}
    </p>
  );
}

function TableRenderer({ children }) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

function TheadRenderer({ children }) {
  return <thead className="bg-orange-50 border-b-2 border-orange-200">{children}</thead>;
}

function ThRenderer({ children }) {
  return <th className="px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-orange-100 last:border-r-0">{children}</th>;
}

function TdRenderer({ children }) {
  return <td className="px-3 py-2 border-b border-gray-100 text-gray-700">{children}</td>;
}

function TrRenderer({ children, ...props }) {
  return <tr className="even:bg-gray-50/60" {...props}>{children}</tr>;
}

function CodeBlockRenderer({ children, className }) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-gray-200">
      {lang && (
        <div className="flex items-center bg-gray-100 px-4 py-1.5 border-b border-gray-200">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">{lang}</span>
        </div>
      )}
      <pre className="bg-gray-50 p-4 overflow-x-auto">
        <code className={`text-sm font-mono text-gray-800 ${className || ''}`}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function InlineCodeRenderer({ children }) {
  return (
    <code className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded text-sm font-mono border border-orange-100">
      {children}
    </code>
  );
}

function BlockquoteRenderer({ children }) {
  return (
    <blockquote className="border-l-4 border-orange-400 bg-orange-50/50 pl-4 pr-3 py-2.5 my-4 rounded-r-lg italic text-gray-600 [&_p]:my-0">
      {children}
    </blockquote>
  );
}

function ListRenderer({ ordered, children, ...props }) {
  const Tag = ordered ? 'ol' : 'ul';
  const cls = ordered
    ? 'list-decimal list-outside pl-7 my-4 space-y-2.5 marker:text-orange-500 marker:font-bold marker:text-[1.05em]'
    : 'list-disc list-outside pl-7 my-4 space-y-2 marker:text-orange-400';
  return <Tag className={cls} {...props}>{children}</Tag>;
}

function ListItemRenderer({ children }) {
  return (
    <li className="pl-1 text-gray-800 leading-8 [&>p]:my-1.5 [&>p:first-child]:text-[1.04em] [&>p:first-child]:font-semibold [&>p:first-child]:text-gray-900 [&>ul]:mt-2 [&>ul]:mb-2 [&>ol]:mt-2 [&>ol]:mb-2">
      {children}
    </li>
  );
}

function StrongRenderer({ children }) {
  return (
    <strong className="font-bold text-gray-900">
      {children}
    </strong>
  );
}

function EmRenderer({ children }) {
  return (
    <em className="italic text-gray-700">
      {children}
    </em>
  );
}

function HrRenderer() {
  return <hr className="my-4 border-0 h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent" />;
}

function LinkRenderer({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-orange-600 underline decoration-orange-300 underline-offset-2 hover:text-orange-800 hover:decoration-orange-500 transition-colors"
    >
      {children}
    </a>
  );
}

function ImageRenderer({ src, alt }) {
  return (
    <img
      src={src}
      alt={alt}
      className="max-w-full h-auto rounded-xl my-3 border border-gray-200"
      loading="lazy"
    />
  );
}

export default function MarkdownRenderer({ content, className = '' }) {
  return (
    <div className={`markdown-body text-gray-800 leading-8 [overflow-wrap:anywhere] ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...props }) => <HeadingRenderer level={1} {...props}>{children}</HeadingRenderer>,
          h2: ({ children, ...props }) => <HeadingRenderer level={2} {...props}>{children}</HeadingRenderer>,
          h3: ({ children, ...props }) => <HeadingRenderer level={3} {...props}>{children}</HeadingRenderer>,
          h4: ({ children, ...props }) => <HeadingRenderer level={4} {...props}>{children}</HeadingRenderer>,
          h5: ({ children, ...props }) => <HeadingRenderer level={5} {...props}>{children}</HeadingRenderer>,
          h6: ({ children, ...props }) => <HeadingRenderer level={6} {...props}>{children}</HeadingRenderer>,
          p: ParagraphRenderer,
          table: TableRenderer,
          thead: TheadRenderer,
          th: ThRenderer,
          td: TdRenderer,
          tr: TrRenderer,
          code: ({ inline, className, children, ...props }) =>
            inline
              ? <InlineCodeRenderer>{children}</InlineCodeRenderer>
              : <CodeBlockRenderer className={className}>{children}</CodeBlockRenderer>,
          pre: ({ children }) => <>{children}</>,
          blockquote: BlockquoteRenderer,
          ul: ({ children, ...props }) => <ListRenderer ordered={false} {...props}>{children}</ListRenderer>,
          ol: ({ children, ...props }) => <ListRenderer ordered={true} {...props}>{children}</ListRenderer>,
          li: ListItemRenderer,
          strong: StrongRenderer,
          em: EmRenderer,
          hr: HrRenderer,
          a: LinkRenderer,
          img: ImageRenderer,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
