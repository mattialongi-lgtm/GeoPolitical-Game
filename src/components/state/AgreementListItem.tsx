/**
 * AgreementListItem – Single agreement/sanction entry in collapsible lists.
 * Shows agreement type, partner entity, status, and optional expiration.
 */
import React from 'react';
import { Handshake, Ban, Shield, AlertTriangle } from 'lucide-react';

type AgreementType = 'alliance' | 'defense_pact' | 'bilateral' | 'unilateral' | 'coalition' | 'sanction_received' | 'sanction_imposed';

interface AgreementListItemProps {
  type: AgreementType;
  partnerName: string;
  partnerFlag?: string;
  status?: string;
  expiresAt?: string;
}

const typeConfig: Record<AgreementType, { icon: React.ElementType; color: string; label: string }> = {
  alliance: { icon: Handshake, color: 'text-emerald-400', label: 'Alleanza' },
  defense_pact: { icon: Shield, color: 'text-sky-400', label: 'Patto difensivo' },
  bilateral: { icon: Handshake, color: 'text-indigo-400', label: 'Accordo bilaterale' },
  unilateral: { icon: Handshake, color: 'text-amber-400', label: 'Accordo unilaterale' },
  coalition: { icon: Shield, color: 'text-purple-400', label: 'Coalizione' },
  sanction_received: { icon: Ban, color: 'text-rose-400', label: 'Sanzione subita' },
  sanction_imposed: { icon: AlertTriangle, color: 'text-amber-400', label: 'Sanzione imposta' },
};

export default function AgreementListItem({
  type,
  partnerName,
  partnerFlag,
  status,
  expiresAt,
}: AgreementListItemProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 p-3 border-b border-gray-800/40 last:border-b-0">
      <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
        {partnerFlag ? (
          <span className="text-lg">{partnerFlag}</span>
        ) : (
          <Icon className={`w-4 h-4 ${config.color}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{partnerName}</p>
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
          {config.label}
        </p>
      </div>
      <div className="text-right shrink-0">
        {status && <p className="text-[10px] font-bold text-gray-400">{status}</p>}
        {expiresAt && <p className="text-[10px] text-gray-600">{expiresAt}</p>}
      </div>
    </div>
  );
}
