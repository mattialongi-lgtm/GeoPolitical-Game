import React, { useState } from 'react';
import { Plus, Trash2, Image as ImageIcon, Video, Link as LinkIcon, Type, ChevronUp, ChevronDown } from 'lucide-react';
import { ArticleBlock, ArticleBlockType } from '../types';

interface Props {
  blocks: ArticleBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<ArticleBlock[]>>;
}

export const ArticleEditor: React.FC<Props> = ({ blocks, setBlocks }) => {
  const addBlock = (type: ArticleBlockType) => {
    const newBlock: ArticleBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      metadata: type === 'image' ? { caption: '' } : type === 'link' ? { title: '', anchorText: '' } : {}
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const updateBlock = (id: string, updates: Partial<ArticleBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div key={block.id} className="relative group bg-gray-800/50 border border-gray-700/40 rounded-2xl p-6 transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:bg-gray-800/70">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${block.type === 'text' ? 'bg-indigo-500/15 text-indigo-400' : block.type === 'image' ? 'bg-orange-500/15 text-orange-400' : block.type === 'video' ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {block.type === 'text' && <Type className="w-4 h-4" />}
                {block.type === 'image' && <ImageIcon className="w-4 h-4" />}
                {block.type === 'video' && <Video className="w-4 h-4" />}
                {block.type === 'link' && <LinkIcon className="w-4 h-4" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{block.type}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => moveBlock(index, 'up')}
                disabled={index === 0}
                className="p-1.5 hover:bg-gray-700/50 rounded-lg disabled:opacity-30"
              >
                <ChevronUp className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => moveBlock(index, 'down')}
                disabled={index === blocks.length - 1}
                className="p-1.5 hover:bg-gray-700/50 rounded-lg disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={() => removeBlock(block.id)} className="p-1.5 hover:bg-rose-500/15 text-rose-400 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {block.type === 'text' && (
            <textarea
              value={block.content}
              onChange={e => updateBlock(block.id, { content: e.target.value })}
              placeholder="Scrivi qui il tuo testo..."
              rows={4}
              className="w-full bg-transparent border-none focus:ring-0 text-gray-300 font-medium placeholder:text-gray-600 resize-none p-0"
            />
          )}

          {block.type === 'image' && (
            <div className="space-y-4">
              <input
                value={block.content}
                onChange={e => updateBlock(block.id, { content: e.target.value })}
                placeholder="URL Immagine (https://...)"
                className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-sm font-bold text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-gray-500"
              />
              <input
                value={block.metadata?.caption || ''}
                onChange={e => updateBlock(block.id, { metadata: { ...block.metadata, caption: e.target.value } })}
                placeholder="Didascalia (opzionale)"
                className="w-full px-4 py-2 rounded-xl bg-transparent border border-gray-700/40 text-xs font-medium text-gray-400 outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-600"
              />
            </div>
          )}

          {block.type === 'video' && (
            <div className="space-y-2">
              <input
                value={block.content}
                onChange={e => updateBlock(block.id, { content: e.target.value })}
                placeholder="URL YouTube (https://www.youtube.com/watch?v=...)"
                className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-sm font-bold text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-gray-500"
              />
              <p className="text-[10px] text-gray-400 font-bold italic ml-2">I video verranno mostrati come player embedded responsive nell'articolo.</p>
            </div>
          )}

          {block.type === 'link' && (
            <div className="space-y-3">
              <input
                value={block.metadata?.title || ''}
                onChange={e => updateBlock(block.id, { metadata: { ...block.metadata, title: e.target.value } })}
                placeholder="Titolo del Link (es. Leggi anche questo)"
                className="w-full px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700/40 text-sm font-bold text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/30 placeholder:text-gray-500"
              />
              <input
                value={block.content}
                onChange={e => updateBlock(block.id, { content: e.target.value })}
                placeholder="URL (https://...)"
                className="w-full px-4 py-2 rounded-xl bg-gray-800/50 border border-gray-700/40 text-xs font-medium text-gray-300 outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-gray-600"
              />
            </div>
          )}
        </div>
      ))}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4">
        {[
          { type: 'text' as ArticleBlockType, icon: <Type className="w-4 h-4" />, label: 'Testo' },
          { type: 'image' as ArticleBlockType, icon: <ImageIcon className="w-4 h-4" />, label: 'Immagine' },
          { type: 'video' as ArticleBlockType, icon: <Video className="w-4 h-4" />, label: 'Video' },
          { type: 'link' as ArticleBlockType, icon: <LinkIcon className="w-4 h-4" />, label: 'Link' },
        ].map(btn => (
          <button
            key={btn.type}
            onClick={() => addBlock(btn.type)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-800/50 border border-gray-700/40 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-indigo-400"
          >
            {btn.icon} {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
};
