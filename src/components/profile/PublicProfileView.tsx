import React, { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ProfileView } from "./ProfileView";

export const PublicProfileView = ({ regions, nations }: { regions: any[], nations: any[] }) => {
  const { userId } = useParams();
  const [targetUser, setTargetUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/players/${userId}`)
      .then(r => r.json())
      .then(d => {
        console.log('[PublicProfileView] Fetch Success:', d);
        if (d && !d.error) {
          console.log('[PublicProfileView] Setting Target User:', d.username);
          setTargetUser(d);
        } else {
          console.error('[PublicProfileView] Server returned error or empty:', d);
          setTargetUser({ error: d?.error || "Unknown error" });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[PublicProfileView] Fetch Exception:', err);
        setTargetUser({ error: err.message });
        setLoading(false);
      });
  }, [userId]);

  console.log('[PublicProfileView] Rendering with userId:', userId, 'loading:', loading, 'targetUser:', !!targetUser);

  if (userId === "all" || !userId) return <Navigate to="/" />;

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-[#76ff03] animate-spin" />
    </div>
  );

  if (!targetUser || targetUser.error) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white gap-6">
      <AlertCircle className="w-16 h-16 text-rose-500" />
      <div className="text-center">
        <p className="text-xl font-black uppercase tracking-widest text-[#76ff03]">Errore 404</p>
        <p className="text-slate-400 font-bold mt-2">Giocatore non trovato o profilo rimosso.</p>
      </div>
      <button onClick={() => navigate(-1)} className="px-10 py-4 bg-white/5 border border-white/10 rounded-none font-black uppercase text-xs tracking-[0.2em] hover:bg-white/10 transition-all">
        Rientra in Base
      </button>
    </div>
  );

  return <ProfileView user={targetUser} regions={regions} nations={nations} isPublic={true} />;
};
