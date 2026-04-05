import React from "react";
import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";

export const Toast = ({ message, onDismiss }: { key?: React.Key; message: string; onDismiss: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 40, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 40, scale: 0.9 }}
    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-emerald-200 flex items-center gap-3 max-w-[90vw]"
  >
    <CheckCircle2 className="w-5 h-5 shrink-0" />
    <span className="font-black text-sm">{message}</span>
    <button onClick={onDismiss} className="ml-2 text-emerald-200 hover:text-white text-xs font-black">✕</button>
  </motion.div>
);
