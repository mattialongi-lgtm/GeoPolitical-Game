import React from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { ArticleBlock } from '../types';

interface Props {
  blocks: ArticleBlock[];
}

export const ArticleBlockRenderer: React.FC<Props> = ({ blocks }) => {
  const renderYouTube = (url: string) => {
    // Extract video ID from youtube URL
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;

    if (!videoId) return <div className="text-red-500 text-xs italic">Video YouTube non valido</div>;

    return (
      <div className="relative w-full pb-[56.25%] h-0 rounded-2xl overflow-hidden shadow-lg my-4 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          className="absolute top-0 left-0 w-full h-full border-0"
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  };

  const renderLink = (block: ArticleBlock) => {
    return (
      <a 
        href={block.content} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 transition-colors my-2 group"
      >
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
          <ExternalLink className="w-4 h-4" />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-xs font-black uppercase tracking-wider">{block.metadata?.title || 'Link Esterno'}</p>
          <p className="text-[10px] font-medium opacity-60 truncate">{block.content}</p>
        </div>
      </a>
    );
  };

  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        switch (block.type) {
          case 'text':
            return (
              <p key={block.id} className="text-slate-700 leading-loose font-medium whitespace-pre-wrap text-base">
                {block.content}
              </p>
            );
          case 'image':
            return (
              <figure key={block.id} className="my-6 space-y-2">
                <img 
                  src={block.content} 
                  alt={block.metadata?.caption || 'Immagine articolo'} 
                  loading="lazy"
                  className="w-full rounded-[2rem] shadow-md border border-slate-100 object-cover max-h-[500px]"
                />
                {block.metadata?.caption && (
                  <figcaption className="text-center text-xs font-bold text-slate-400 italic">
                    {block.metadata.caption}
                  </figcaption>
                )}
              </figure>
            );
          case 'video':
            return <div key={block.id}>{renderYouTube(block.content)}</div>;
          case 'link':
            return <div key={block.id}>{renderLink(block)}</div>;
          default:
            return null;
        }
      })}
    </div>
  );
};
