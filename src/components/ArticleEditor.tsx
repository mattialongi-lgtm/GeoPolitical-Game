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
        <div key={block.id} className="relative group bg-slate-50 border border-slate-100 rounded-3xl p-6 transition-all focus-within:ring-2 focus-within:ring-indigo-100 focus-within:bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${block.type === 'text' ? 'bg-indigo-100 text-indigo-600' : block.type === 'image' ? 'bg-orange-100 text-orange-600' : block.type === 'video' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {block.type === 'text' && <Type className="w-4 h-4" />}
                {block.type === 'image' && <ImageIcon className="w-4 h-4" />}
                {block.type === 'video' && <Video className="w-4 h-4" />}
                {block.type === 'link' && <LinkIcon className="w-4 h-4" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{block.type}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => moveBlock(index, 'up')} 
                disabled={index === 0}
                className="p-1.5 hover:bg-slate-200 rounded-lg disabled:opacity-30"
              >
                <ChevronUp className="w-4 h-4 text-slate-500" />
              </button>
              <button 
                onClick={() => moveBlock(index, 'down')} 
                disabled={index === blocks.length - 1}
                className="p-1.5 hover:bg-slate-200 rounded-lg disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
              <button onClick={() => removeBlock(block.id)} className="p-1.5 hover:bg-rose-100 text-rose-500 rounded-lg">
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
              className="w-full bg-transparent border-none focus:ring-0 text-slate-700 font-medium placeholder:text-slate-300 resize-none p-0"
            />
          )}

          {block.type === 'image' && (
            <div className="space-y-4">
              <input
                value={block.content}
                onChange={e => updateBlock(block.id, { content: e.target.value })}
                placeholder="URL Immagine (https://...)"
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-600"
              />
              <input
                value={block.metadata?.caption || ''}
                onChange={e => updateBlock(block.id, { metadata: { ...block.metadata, caption: e.target.value } })}
                placeholder="Didascalia (opzionale)"
                className="w-full px-4 py-2 rounded-xl bg-transparent border-slate-100 text-xs font-medium text-slate-400"
              />
            </div>
          )}

          {block.type === 'video' && (
            <div className="space-y-2">
              <input
                value={block.content}
                onChange={e => updateBlock(block.id, { content: e.target.value })}
                placeholder="URL YouTube (https://www.youtube.com/watch?v=...)"
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-600"
              />
              <p className="text-[10px] text-slate-400 font-bold italic ml-2">I video verranno mostrati come player embedded responsive nell'articolo.</p>
            </div>
          )}

          {block.type === 'link' && (
            <div className="space-y-3">
              <input
                value={block.metadata?.title || ''}
                onChange={e => updateBlock(block.id, { metadata: { ...block.metadata, title: e.target.value } })}
                placeholder="Titolo del Link (es. Leggi anche questo)"
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-100 text-sm font-bold text-slate-900"
              />
              <input
                value={block.content}
                onChange={e => updateBlock(block.id, { content: e.target.value })}
                placeholder="URL (https://...)"
                className="w-full px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600"
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
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-indigo-400 hover:bg-indigo-50 transition-all font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-indigo-600"
          >
            {btn.icon} {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
};
