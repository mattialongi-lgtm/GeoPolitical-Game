import { useState, useEffect } from "react";

const Leaderboard = () => {
  const [leaders, setLeaders] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard").then(res => res.json()).then(setLeaders);
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Rank</th>
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Player</th>
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Livello</th>
            <th className="pb-4 font-bold text-slate-400 uppercase text-xs">Wealth</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((leader, i) => (
            <tr key={leader.username} className="border-b border-slate-50 last:border-0">
              <td className="py-4 font-bold text-slate-400">#{i + 1}</td>
              <td className="py-4 font-bold text-slate-900">{leader.username}</td>
              <td className="py-4 font-bold text-indigo-600">Lv {leader.level}</td>
              <td className="py-4 font-bold text-emerald-600">${leader.money.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;
